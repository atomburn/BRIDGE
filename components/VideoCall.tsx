import React, { useEffect, useRef, useState } from 'react';
import { ConnectionState } from '../types';
import { Check, Video, Mic, MicOff, VideoOff, PhoneOff, ArrowLeft, RefreshCw, Smartphone, AlertTriangle, Network, Loader2, Info, Play, ShieldCheck } from 'lucide-react';

// VERSION TRACKER - Check this footer on your device to confirm deployment
const APP_VERSION = "v0.8.5 (Stream Accumulator)";

// Extensive list of free public STUN servers
const SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

const VideoCall: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [iceStatus, setIceStatus] = useState<RTCIceConnectionState>('new');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [remoteCodeInput, setRemoteCodeInput] = useState<string>('');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [gatheringIce, setGatheringIce] = useState(false);
  const [debugStats, setDebugStats] = useState<string>('Initializing...');
  const [showStats, setShowStats] = useState(false);
  const [manualPlayNeeded, setManualPlayNeeded] = useState(false);

  // References
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  
  // CRITICAL: Persistent Remote Stream Accumulator
  // We don't rely on the event.streams[0] to be correct. We build our own.
  const remoteStreamAccumulator = useRef<MediaStream>(new MediaStream());

  const statsInterval = useRef<number | null>(null);

  // Initialize Local Media
  useEffect(() => {
    const startMedia = async () => {
      try {
        console.log(`[${APP_VERSION}] Requesting user media...`);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        setMediaReady(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media:", err);
        setDebugStats("Error: Could not access Camera/Mic");
      }
    };
    startMedia();

    return () => {
      // Cleanup
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (statsInterval.current) {
        window.clearInterval(statsInterval.current);
      }
    };
  }, []);

  // Monitor Stats
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      statsInterval.current = window.setInterval(async () => {
        if (!peerConnection.current) return;
        
        // 1. Check Connection Stats
        const stats = await peerConnection.current.getStats();
        let bytesReceived = 0;
        let packetsLost = 0;
        
        stats.forEach(report => {
           if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video')) {
              bytesReceived = report.bytesReceived;
              packetsLost = report.packetsLost;
           }
        });

        // 2. Check Track Status
        const videoTracks = remoteStreamAccumulator.current.getVideoTracks();
        const audioTracks = remoteStreamAccumulator.current.getAudioTracks();
        const vStatus = videoTracks.length > 0 ? videoTracks[0].readyState : 'none';
        const aStatus = audioTracks.length > 0 ? audioTracks[0].readyState : 'none';

        setDebugStats(
          `ICE: ${peerConnection.current.iceConnectionState}\n` +
          `Video Rx: ${(bytesReceived / 1024).toFixed(0)} KB\n` +
          `Packets Lost: ${packetsLost}\n` +
          `Tracks: V[${vStatus}] A[${aStatus}]`
        );
      }, 2000);
    }
  }, [connectionState]);

  const createPeerConnection = () => {
    if (peerConnection.current) return peerConnection.current;

    console.log(`[${APP_VERSION}] Creating RTCPeerConnection`);
    const pc = new RTCPeerConnection(SERVERS);

    // Force Transceivers to ensure SDP allocates space for video even if stream is late
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    // ON TRACK - The Core Fix
    pc.ontrack = (event) => {
      console.log(`[${APP_VERSION}] Track received: ${event.track.kind}`);
      
      // Add the incoming track to our persistent accumulator
      remoteStreamAccumulator.current.addTrack(event.track);

      // Force attachment to DOM
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamAccumulator.current;
        
        // Attempt play
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Autoplay prevented:", error);
            setManualPlayNeeded(true);
          });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection State:", pc.connectionState);
      if (pc.connectionState === 'connected') setConnectionState(ConnectionState.CONNECTED);
      else if (pc.connectionState === 'failed') setConnectionState(ConnectionState.FAILED);
    };

    pc.oniceconnectionstatechange = () => {
      setIceStatus(pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        console.log("ICE Candidate Gathering Complete");
        const description = pc.localDescription;
        if (description) {
          // Encode the entire session description including all candidates
          const code = btoa(JSON.stringify(description));
          setGeneratedCode(code);
          setGatheringIce(false); 
        }
      }
    };

    peerConnection.current = pc;
    return pc;
  };

  const startAsHost = async () => {
    if (!mediaReady) return;
    const pc = createPeerConnection();
    setConnectionState(ConnectionState.CREATING_OFFER);
    setGatheringIce(true);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Wait for ICE gathering to complete (handled in onicecandidate)
    } catch (e) {
      console.error("Error creating offer:", e);
      setGatheringIce(false);
    }
  };

  const joinAsGuest = async () => {
    if (!mediaReady) return;
    createPeerConnection(); 
    setConnectionState(ConnectionState.PROCESSING_OFFER);
  };

  const processRemoteCode = async () => {
    if (!remoteCodeInput) return;
    try {
      const pc = peerConnection.current || createPeerConnection();
      const decoded = atob(remoteCodeInput);
      const remoteDesc = JSON.parse(decoded);

      await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));

      if (pc.remoteDescription?.type === 'offer') {
        setConnectionState(ConnectionState.WAITING_FOR_ANSWER);
        setGatheringIce(true);
        // Create Answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        // Wait for ICE gathering to complete
      } else if (pc.remoteDescription?.type === 'answer') {
        setConnectionState(ConnectionState.CONNECTED);
      }
    } catch (e) {
      console.error("Invalid code", e);
      alert("Invalid connection code. Please ensure you copied the entire text.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const manualPlayVideo = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play();
      setManualPlayNeeded(false);
    }
  };

  // Robust Media Toggling
  const toggleMic = () => {
    const newState = !micOn;
    setMicOn(newState);
    if (peerConnection.current) {
      peerConnection.current.getSenders().forEach(sender => {
        if (sender.track?.kind === 'audio') sender.track.enabled = newState;
      });
    }
  };

  const toggleCam = () => {
    const newState = !cameraOn;
    setCameraOn(newState);
    if (peerConnection.current) {
      peerConnection.current.getSenders().forEach(sender => {
        if (sender.track?.kind === 'video') sender.track.enabled = newState;
      });
    }
  };

  const isVPNIssue = iceStatus === 'disconnected' || iceStatus === 'failed' || iceStatus === 'closed';

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white relative overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-800/80 backdrop-blur-md flex justify-between items-center z-10 border-b border-slate-700">
        <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
             <h2 className="text-lg font-semibold tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                {connectionState === ConnectionState.CONNECTED ? 'Secure Call' : 'Setup'}
            </h2>
            {connectionState === ConnectionState.CONNECTED && (
                 <div onClick={() => setShowStats(!showStats)} className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <div className={`w-2 h-2 rounded-full ${iceStatus === 'connected' || iceStatus === 'completed' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                        {iceStatus}
                    </span>
                 </div>
            )}
        </div>
        <div className="flex gap-2">
             <button onClick={() => setShowStats(!showStats)} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
                <Info className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        
        {/* Videos Container */}
        <div className={`relative w-full max-w-6xl h-full flex ${connectionState === ConnectionState.CONNECTED ? 'flex-col md:flex-row gap-4' : 'justify-center items-center'}`}>
          
          {/* Debug Info Overlay */}
          {showStats && (
              <div className="absolute top-4 left-4 z-50 bg-black/90 p-4 rounded-lg text-xs font-mono text-green-400 border border-green-500/30 whitespace-pre-wrap">
                  {debugStats}
              </div>
          )}

          {/* Remote Video (Main) */}
          {connectionState === ConnectionState.CONNECTED && (
             <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-slate-700 group">
               <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover" 
              />
              
              {/* Manual Play Button (If Autoplay blocked) */}
              {manualPlayNeeded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
                  <button onClick={manualPlayVideo} className="p-6 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-md transition">
                    <Play className="w-12 h-12 text-white fill-white" />
                  </button>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-sm backdrop-blur-md">
                Remote
              </div>
              
              {isVPNIssue && (
                 <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 z-20">
                    <Network className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Connection Blocked</h3>
                    <p className="text-slate-300 max-w-sm mb-4">VPN or Firewall is blocking video packets.</p>
                    <p className="text-xs text-slate-500 font-mono">Status: {iceStatus}</p>
                 </div>
              )}
             </div>
          )}

          {/* Local Video (Preview or PiP) */}
          <div className={`${connectionState === ConnectionState.CONNECTED ? 'absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-72 shadow-2xl border-2 border-slate-700' : 'w-full max-w-md aspect-video shadow-xl border border-slate-700'} bg-black rounded-2xl overflow-hidden transition-all duration-500 relative`}>
             <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform scale-x-[-1] ${!cameraOn && 'opacity-0'}`} 
             />
             {!cameraOn && (
               <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                 <VideoOff className="w-12 h-12" />
               </div>
             )}
             <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded-full text-xs backdrop-blur-md">You</div>
          </div>

          {/* Setup Wizard */}
          {connectionState !== ConnectionState.CONNECTED && (
            <div className="absolute top-0 left-0 w-full h-full bg-slate-900/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
              
              {connectionState === ConnectionState.IDLE && (
                <div className="space-y-6 max-w-md w-full">
                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <h3 className="text-xl font-bold mb-4">Select Role</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={startAsHost}
                        disabled={!mediaReady}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition flex flex-col items-center gap-2 disabled:opacity-50"
                      >
                        <Smartphone className="w-8 h-8 text-teal-400" />
                        <span className="font-semibold">I'm Starting</span>
                      </button>
                      <button 
                        onClick={joinAsGuest}
                        disabled={!mediaReady}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition flex flex-col items-center gap-2 disabled:opacity-50"
                      >
                         <Check className="w-8 h-8 text-blue-400" />
                        <span className="font-semibold">I Have a Code</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Waiting for ICE */}
              {gatheringIce && (
                <div className="flex flex-col items-center animate-pulse">
                  <RefreshCw className="w-10 h-10 text-teal-400 mb-4 animate-spin" />
                  <p className="text-lg font-bold">Generating Secure Keys...</p>
                  <p className="text-xs text-slate-500 mt-2">Please wait. Do not close.</p>
                </div>
              )}

              {/* Step 1 & 2: Show Offer */}
              {(connectionState === ConnectionState.CREATING_OFFER && generatedCode && !gatheringIce) && (
                <div className="max-w-md w-full space-y-6 text-left">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Send Link</h4>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-xs text-slate-400 font-mono truncate">
                        {window.location.href}
                      </div>
                      <button onClick={copyLink} className="px-3 bg-slate-700 rounded-md font-bold text-xs">{linkCopied ? 'COPIED' : 'COPY'}</button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Send Code</h4>
                    <div className="relative">
                      <textarea readOnly value={generatedCode} className="w-full h-24 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none" />
                      <button onClick={copyToClipboard} className="absolute bottom-3 right-3 px-3 py-1 bg-teal-600 text-white rounded-md text-xs font-bold">{copied ? "COPIED" : "COPY"}</button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700 space-y-3">
                     <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">3. Paste Their Reply</h4>
                     <textarea 
                      placeholder="Paste the code they send back here..."
                      value={remoteCodeInput}
                      onChange={(e) => setRemoteCodeInput(e.target.value)}
                      className="w-full h-20 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono resize-none focus:border-blue-500 focus:outline-none transition"
                    />
                    <button onClick={processRemoteCode} disabled={!remoteCodeInput} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition">Connect Video</button>
                  </div>
                </div>
              )}

              {/* Guest Steps */}
              {(connectionState === ConnectionState.PROCESSING_OFFER) && (
                 <div className="max-w-md w-full space-y-4">
                  <h3 className="text-xl font-bold text-teal-400">Step 1: Paste Code</h3>
                  <textarea 
                      placeholder="Paste the code you received..."
                      value={remoteCodeInput}
                      onChange={(e) => setRemoteCodeInput(e.target.value)}
                      className="w-full h-32 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono resize-none focus:border-teal-500 focus:outline-none transition"
                    />
                    <button onClick={processRemoteCode} disabled={!remoteCodeInput} className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-lg transition">Generate Reply Code</button>
                 </div>
              )}

              {(connectionState === ConnectionState.WAITING_FOR_ANSWER && generatedCode && !gatheringIce) && (
                 <div className="max-w-md w-full space-y-4">
                  <h3 className="text-xl font-bold text-blue-400">Step 2: Send Reply</h3>
                   <div className="relative">
                    <textarea readOnly value={generatedCode} className="w-full h-32 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none" />
                    <button onClick={copyToClipboard} className="absolute bottom-3 right-3 px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-bold">{copied ? "COPIED" : "COPY"}</button>
                  </div>
                  <p className="text-xs text-slate-500">Copy this code and send it back to the host.</p>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Version Info */}
      <div className="absolute bottom-0 w-full text-center p-1 pointer-events-none z-0">
        <span className="text-[10px] text-slate-700">{APP_VERSION}</span>
      </div>

      {/* Controls */}
      <div className="p-6 flex justify-center items-center gap-6 bg-slate-900/90 backdrop-blur z-30 border-t border-slate-800">
        <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${micOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 text-white'}`}>
          {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>
        <button onClick={() => { peerConnection.current?.close(); onBack(); }} className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full px-8 flex items-center gap-2 font-bold">
          <PhoneOff className="w-6 h-6" /> <span className="hidden md:inline">End Call</span>
        </button>
        <button onClick={toggleCam} className={`p-4 rounded-full transition-all ${cameraOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 text-white'}`}>
          {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default VideoCall;