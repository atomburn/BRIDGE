import React, { useEffect, useRef, useState } from 'react';
import { ConnectionState } from '../types';
import { Copy, Check, Video, Mic, MicOff, VideoOff, PhoneOff, ArrowLeft, RefreshCw, Smartphone, Link as LinkIcon, AlertTriangle, Network, Loader2 } from 'lucide-react';

const SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
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
  const [mediaError, setMediaError] = useState<string>('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  // Initialize Media
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        setMediaReady(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media:", err);
        setMediaError("Could not access camera/microphone. Please check permissions.");
      }
    };
    startMedia();

    return () => {
      // Cleanup tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      // Cleanup connection
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, []);

  const createPeerConnection = () => {
    // If a connection already exists, return it.
    // NOTE: This prevents duplicate connections but we must ensure tracks are added.
    if (peerConnection.current) return peerConnection.current;

    const pc = new RTCPeerConnection(SERVERS);

    // CRITICAL: Add local tracks immediately upon creation
    // We rely on mediaReady state to prevent calling this function before stream exists
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    } else {
        console.warn("CreatePeerConnection called without local stream!");
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log("Remote track received", event.streams);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log("Connection State:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionState(ConnectionState.CONNECTED);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionState(ConnectionState.FAILED);
      }
    };

    // Monitor ICE state (VPN Debugging)
    pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);
        setIceStatus(pc.iceConnectionState);
    };

    // ICE Candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        // Gathering complete
        const offerOrAnswer = pc.localDescription;
        if (offerOrAnswer) {
          const code = btoa(JSON.stringify(offerOrAnswer));
          setGeneratedCode(code);
        }
      }
    };

    peerConnection.current = pc;
    return pc;
  };

  const startAsHost = async () => {
    if (!mediaReady) return; // Guard against race condition
    const pc = createPeerConnection();
    setConnectionState(ConnectionState.CREATING_OFFER);
    
    // Explicitly creating offer with receive audio/video options helps compatibility
    const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    });
    await pc.setLocalDescription(offer);
  };

  const joinAsGuest = async () => {
    if (!mediaReady) return; // Guard against race condition
    createPeerConnection(); // Initialize PC and add tracks
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
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        setConnectionState(ConnectionState.WAITING_FOR_ANSWER);
      } else if (pc.remoteDescription?.type === 'answer') {
        setConnectionState(ConnectionState.CONNECTED);
      }
    } catch (e) {
      console.error("Invalid code", e);
      alert("Invalid connection code. Please check and try again.");
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

  const toggleMic = () => {
    const newState = !micOn;
    setMicOn(newState);

    // 1. Update Local Stream (for UI state consistency)
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => t.enabled = newState);
    }

    // 2. Update Active Connection Senders (Critical for ensuring remote side stops hearing)
    if (peerConnection.current) {
        peerConnection.current.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
                sender.track.enabled = newState;
            }
        });
    }
  };

  const toggleCam = () => {
    const newState = !cameraOn;
    setCameraOn(newState);

    // 1. Update Local Stream
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(t => t.enabled = newState);
    }
    
    // 2. Update Active Connection Senders
    if (peerConnection.current) {
        peerConnection.current.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'video') {
                sender.track.enabled = newState;
            }
        });
    }
  };

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isVPNIssue = iceStatus === 'disconnected' || iceStatus === 'failed';

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white relative overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-800/80 backdrop-blur-md flex justify-between items-center z-10 border-b border-slate-700">
        <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
             <h2 className="text-lg font-semibold tracking-wide">
                {connectionState === ConnectionState.CONNECTED ? 'Secure Call' : 'Setup Connection'}
            </h2>
            {connectionState === ConnectionState.CONNECTED && (
                 <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-2 h-2 rounded-full ${isVPNIssue ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                        {isVPNIssue ? 'Network Unstable' : 'Encrypted P2P'}
                    </span>
                 </div>
            )}
        </div>
       
        <div className={`w-3 h-3 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500'}`} />
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        
        {/* Videos Container */}
        <div className={`relative w-full max-w-6xl h-full flex ${connectionState === ConnectionState.CONNECTED ? 'flex-col md:flex-row gap-4' : 'justify-center items-center'}`}>
          
          {/* Remote Video (Main) */}
          {connectionState === ConnectionState.CONNECTED && (
             <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-slate-700 group">
               <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover" 
              />
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-sm backdrop-blur-md">
                Remote
              </div>
              
              {/* VPN Warning Overlay */}
              {isVPNIssue && (
                 <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
                    <Network className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Connection Blocked</h3>
                    <p className="text-slate-300 max-w-sm">
                        It looks like a Firewall or VPN is blocking the video signal.
                    </p>
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-200">
                        Try disabling your VPN temporarily or switching to a different server location.
                    </div>
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
             
             {!mediaReady && !mediaError && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm z-20">
                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-2" />
                    <p className="text-xs text-teal-400 font-medium">Initializing Camera...</p>
                 </div>
             )}
             
             {mediaError && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 p-4 text-center">
                    <AlertTriangle className="w-8 h-8 text-white mb-2" />
                    <p className="text-xs text-white">{mediaError}</p>
                 </div>
             )}

             <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded-full text-xs backdrop-blur-md">
                You
             </div>
          </div>

          {/* Setup Wizard Overlay */}
          {connectionState !== ConnectionState.CONNECTED && (
            <div className="absolute top-0 left-0 w-full h-full bg-slate-900/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
              
              {connectionState === ConnectionState.IDLE && (
                <div className="space-y-6 max-w-md w-full">
                  <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
                    Secure Peer Connection
                  </h3>
                  <p className="text-slate-400">
                    No server. No tracking. Just you and your family.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={startAsHost}
                      disabled={!mediaReady}
                      className="p-6 bg-slate-800 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-teal-500 transition-all group flex flex-col items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="p-3 bg-teal-500/10 rounded-full group-hover:bg-teal-500/20 text-teal-400">
                         <Smartphone className="w-8 h-8" />
                      </div>
                      <span className="font-semibold">I'm Starting the Call</span>
                    </button>
                    <button 
                      onClick={joinAsGuest}
                      disabled={!mediaReady}
                      className="p-6 bg-slate-800 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-blue-500 transition-all group flex flex-col items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 text-blue-400">
                         <Check className="w-8 h-8" />
                      </div>
                      <span className="font-semibold">I Have a Code</span>
                    </button>
                  </div>
                  {!mediaReady && !mediaError && (
                      <p className="text-xs text-yellow-500 animate-pulse">Waiting for camera access...</p>
                  )}
                </div>
              )}

              {/* Host: Generating Offer */}
              {(connectionState === ConnectionState.CREATING_OFFER && !generatedCode) && (
                <div className="flex flex-col items-center animate-pulse">
                  <RefreshCw className="w-10 h-10 text-teal-400 mb-4 animate-spin" />
                  <p className="text-lg">Generating secure keys...</p>
                </div>
              )}

              {/* Host: Display Codes */}
              {(connectionState === ConnectionState.CREATING_OFFER && generatedCode) && (
                <div className="max-w-md w-full space-y-6 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-teal-400">Invite Your Family</h3>
                  </div>

                  {isLocal && (
                    <div className="p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-yellow-100 space-y-1">
                        <p><strong>Localhost Detected:</strong> Your link won't work for her if you send it now.</p>
                        <p>Deploy this app (Netlify, Vercel, etc) first, then share the public link.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1: Send App Link</h4>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-800 border border-slate-600 rounded-md px-3 py-3 text-xs text-slate-400 font-mono truncate">
                        {window.location.href}
                      </div>
                      <button 
                        onClick={copyLink}
                        className={`px-4 rounded-md font-bold text-xs transition flex items-center gap-2 ${linkCopied ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                      >
                         {linkCopied ? <Check className="w-3 h-3"/> : <LinkIcon className="w-3 h-3"/>}
                         {linkCopied ? 'COPIED' : 'COPY'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2: Send Connection Code</h4>
                    <div className="relative">
                      <textarea 
                        readOnly
                        value={generatedCode}
                        className="w-full h-24 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono focus:outline-none focus:border-teal-500 resize-none text-slate-300"
                      />
                      <button 
                        onClick={copyToClipboard}
                        className="absolute bottom-3 right-3 p-2 bg-teal-600 hover:bg-teal-500 text-white rounded-md shadow-lg flex items-center gap-2 text-xs font-bold transition"
                      >
                        {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                        {copied ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700 space-y-3">
                     <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Step 3: Paste Their Reply Code</h4>
                     <textarea 
                      placeholder="Paste the code they send back here..."
                      value={remoteCodeInput}
                      onChange={(e) => setRemoteCodeInput(e.target.value)}
                      className="w-full h-20 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <button 
                      onClick={processRemoteCode}
                      disabled={!remoteCodeInput}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                    >
                      Connect Video
                    </button>
                  </div>
                </div>
              )}

              {/* Guest: Input Offer */}
              {(connectionState === ConnectionState.PROCESSING_OFFER && !generatedCode) && (
                 <div className="max-w-md w-full space-y-4">
                  <h3 className="text-xl font-bold text-teal-400">Step 1: Paste Code</h3>
                  <p className="text-sm text-slate-400">Paste the connection code you received.</p>
                  <textarea 
                      placeholder="Paste received code here..."
                      value={remoteCodeInput}
                      onChange={(e) => setRemoteCodeInput(e.target.value)}
                      className="w-full h-32 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono focus:outline-none focus:border-teal-500 resize-none"
                    />
                    <button 
                      onClick={processRemoteCode}
                      disabled={!remoteCodeInput}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                    >
                      Generate Reply Code
                    </button>
                 </div>
              )}

              {/* Guest: Output Answer */}
              {(connectionState === ConnectionState.WAITING_FOR_ANSWER && generatedCode) && (
                 <div className="max-w-md w-full space-y-4">
                  <h3 className="text-xl font-bold text-blue-400">Step 2: Send Reply</h3>
                  <p className="text-sm text-slate-400">Send this reply code back to start the call.</p>
                   <div className="relative">
                    <textarea 
                      readOnly
                      value={generatedCode}
                      className="w-full h-32 bg-slate-800 rounded-lg border border-slate-600 p-3 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none text-slate-300"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow-lg flex items-center gap-2 text-xs font-bold transition"
                    >
                      {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                      {copied ? "COPIED" : "COPY"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">The video will start automatically once they paste this code.</p>
                 </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Controls */}
      <div className="p-6 flex justify-center items-center gap-6 bg-slate-900/90 backdrop-blur z-30 border-t border-slate-800">
        <button 
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all ${micOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}
        >
          {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>
        <button 
          onClick={() => {
             peerConnection.current?.close();
             onBack();
          }}
          className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-600/30 px-8 flex items-center gap-2 font-bold"
        >
          <PhoneOff className="w-6 h-6" />
          <span className="hidden md:inline">End Call</span>
        </button>
        <button 
          onClick={toggleCam}
          className={`p-4 rounded-full transition-all ${cameraOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}
        >
          {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default VideoCall;