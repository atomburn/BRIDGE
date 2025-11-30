export enum ConnectionState {
  IDLE = 'IDLE',
  CREATING_OFFER = 'CREATING_OFFER',
  WAITING_FOR_ANSWER = 'WAITING_FOR_ANSWER',
  PROCESSING_OFFER = 'PROCESSING_OFFER',
  CONNECTED = 'CONNECTED',
  FAILED = 'FAILED'
}

export enum AppMode {
  HOME = 'HOME',
  CALL = 'CALL',
  TEST_CALL = 'TEST_CALL',
  TRANSLATOR = 'TRANSLATOR'
}

export interface WebRTCSignal {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'model';
  text: string;
}