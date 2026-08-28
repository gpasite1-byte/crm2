import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import Peer, { MediaConnection } from 'peerjs';
import Pusher from 'pusher-js';
import * as Ably from 'ably';
import { db, checkIsQuotaExhausted } from '../lib/firebase';
import { Usuario } from '../types';
import UserAvatar from './UserAvatar';
import {
  MessageSquare,
  Hash,
  Send,
  Phone,
  Video,
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Paperclip,
  Smile,
  Search,
  Plus,
  Users,
  CheckCircle2,
  Circle,
  Clock,
  MoreVertical,
  X,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Radio,
  Globe,
  Zap,
  Settings,
  Info,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  UserCheck,
  ArrowLeft,
  Activity,
  Sparkles,
  Download,
  Headphones,
  Check
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  channelId: string; // e.g. "c_general" or "dm_u1_u2"
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  createdAt?: number;
  attachment?: {
    type: 'image' | 'file';
    url: string;
    name: string;
  };
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  replyToId?: string;
  isSystem?: boolean;
}

// Global Pusher & Ably Clients for Failover (Environment configurable with seamless failover)
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || "a550429481c13c39f9a6";
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || "sa1";
const ABLY_KEY = import.meta.env.VITE_ABLY_API_KEY || "m2MFEg.B7JOLQ:u_MtYkbldvUScXPtRmsnN7MglKkVGlxJquINjmlVsOo";

let pusherClient: Pusher | null = null;
try {
  if (PUSHER_KEY) {
    pusherClient = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
  }
} catch (e) {
  console.warn('Pusher client setup notice:', e);
}

let ablyClient: Ably.Realtime | null = null;
try {
  if (ABLY_KEY) {
    ablyClient = new Ably.Realtime({ key: ABLY_KEY });
  }
} catch (e) {
  console.warn('Ably client setup notice:', e);
}

export function getDMChannelId(userAId: string, userBId: string): string {
  const cleanA = (userAId || '').toString().trim().toLowerCase();
  const cleanB = (userBId || '').toString().trim().toLowerCase();
  const ids = [cleanA, cleanB].sort();
  return `dm_${ids[0]}_${ids[1]}`;
}

export function sortMessages(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort((a, b) => {
    const timeA = a.createdAt || (a.timestamp ? Date.parse(`1970-01-01T${a.timestamp}:00Z`) || 0 : 0);
    const timeB = b.createdAt || (b.timestamp ? Date.parse(`1970-01-01T${b.timestamp}:00Z`) || 0 : 0);
    return timeA - timeB;
  });
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  isGroup: boolean;
  members?: string[]; // user IDs
  unreadCount?: number;
}

export interface ChatViewProps {
  loggedUser: Usuario;
  comerciais: Usuario[];
  onLogOperation?: (tipo: string, modulo: string, item: string, descricao: string) => void;
  onAddNotification?: (title: string, text: string, type?: 'success' | 'info' | 'warn') => void;
  onNavigateTab?: (tabId: string) => void;
  activeTab?: string;
}

// Web Audio API Ringtone Synthesizer
function playRingTone(): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return () => {};
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    let isRinging = true;

    const playChime = () => {
      if (!isRinging || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc2.frequency.setValueAtTime(480, ctx.currentTime); // tone pair

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
    };

    playChime();
    const interval = setInterval(() => {
      if (isRinging) playChime();
    }, 2200);

    return () => {
      isRinging = false;
      clearInterval(interval);
      try { ctx.close(); } catch (e) {}
    };
  } catch (e) {
    return () => {};
  }
}

// Web Audio API Incoming Message Chime
function playNotificationPing(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => { try { ctx.close(); } catch {} }, 300);
  } catch (e) {}
}

export default function ChatView({ loggedUser, comerciais, onLogOperation, onAddNotification, onNavigateTab, activeTab }: ChatViewProps) {
  // Presence state
  const [userStatus, setUserStatus] = useState<'online' | 'ausente' | 'ocupado'>('online');
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'todos' | 'online' | 'offline' | 'canais'>('todos');
  
  // Real-time Active Online Users Set
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set([loggedUser.id]));

  // Initial channels
  const defaultChannels: ChatChannel[] = [
    { id: 'c_geral', name: 'equipa-geral-gpa', description: 'Canal geral da equipa comercial GPA Angola', isGroup: true, unreadCount: 0 },
    { id: 'c_propostas', name: 'vendas-e-propostas', description: 'Acompanhamento de grandes propostas e metas', isGroup: true, unreadCount: 1 },
    { id: 'c_direcao', name: 'direcao-comercial', description: 'Alinhamento estratégico com a administração', isGroup: true, unreadCount: 0 },
  ];

  const [channels, setChannels] = useState<ChatChannel[]>(() => {
    try {
      const saved = localStorage.getItem('gpa_chat_channels');
      return saved ? JSON.parse(saved) : defaultChannels;
    } catch {
      return defaultChannels;
    }
  });

  const [activeChannelId, setActiveChannelId] = useState<string>('c_geral');
  const [activeDMUser, setActiveDMUser] = useState<Usuario | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  // Initial seed messages
  const seedMessages: ChatMessage[] = [
    {
      id: 'm_1',
      channelId: 'c_geral',
      senderId: 'u_admin',
      senderName: 'Administração GPA',
      text: 'Bem-vindos ao Chat & Comunicação em Tempo Real GPA Angola! Alinhe visitas, grandes propostas e efetue chamadas de voz e vídeo HD com a equipa.',
      timestamp: '08:30',
      reactions: { '🚀': ['u_admin'] }
    },
    {
      id: 'm_2',
      channelId: 'c_geral',
      senderId: comerciais[0]?.id || 'u_1',
      senderName: comerciais[0]?.nome || 'Comercial GPA',
      text: 'Excelente! Todos os dados de propostas e mapas de fecho de Julho/Agosto estão sincronizados.',
      timestamp: '09:15'
    }
  ];

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('gpa_chat_messages');
      return saved ? JSON.parse(saved) : seedMessages;
    } catch {
      return seedMessages;
    }
  });

  // Message input
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ type: 'image' | 'file'; url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calls & Real-time Signaling
  const [activeCall, setActiveCall] = useState<{
    callId?: string;
    isOpen: boolean;
    type: 'audio' | 'video';
    callerName: string;
    status: 'calling' | 'connected';
    duration: number;
    isMuted: boolean;
    isCameraOff: boolean;
    isFullscreen: boolean;
  } | null>(null);

  // Incoming Call signal for receiver
  const [incomingCallSignal, setIncomingCallSignal] = useState<{
    callId: string;
    callerId: string;
    callerName: string;
    callerFoto?: string;
    type: 'audio' | 'video';
    channelId: string;
  } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const activeMediaCallRef = useRef<MediaConnection | null>(null);

  const handledCallIdsRef = useRef<Set<string>>(new Set());
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(null);
  const [remoteStreamState, setRemoteStreamState] = useState<MediaStream | null>(null);

  const [myPeerId, setMyPeerId] = useState<string>('');
  const [peerConnected, setPeerConnected] = useState<boolean>(false);
  const [showCPaaSModal, setShowCPaaSModal] = useState<boolean>(false);

  // Audio Note / Voice Message Recorder State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const callTimerRef = useRef<any>(null);
  const ringStopRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ----------------------------------------------------
  // REAL-TIME PRESENCE ENGINE (Online 🟢 / Offline 🔴)
  // ----------------------------------------------------
  const [onlinePresence, setOnlinePresence] = useState<{
    userIds: Set<string>;
    emails: Set<string>;
    names: Set<string>;
  }>(() => ({
    userIds: new Set([loggedUser.id]),
    emails: new Set([loggedUser.email ? loggedUser.email.toLowerCase() : '']),
    names: new Set([loggedUser.nome ? loggedUser.nome.toLowerCase() : ''])
  }));

  const fetchPresenceData = async () => {
    try {
      const res = await fetch('/api/realtime/presence');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const uIds = new Set<string>([...(data.onlineUserIds || []), loggedUser.id]);
          const emails = new Set<string>([...(data.onlineEmails || []), (loggedUser.email || '').toLowerCase()].filter(Boolean));
          const names = new Set<string>([...(data.onlineNames || []), (loggedUser.nome || '').toLowerCase()].filter(Boolean));
          setOnlinePresence({ userIds: uIds, emails, names });
        }
      }
    } catch (e) {}
  };

  // Continuous background polling of messages to guarantee instant message arrival
  useEffect(() => {
    let isSubscribed = true;

    const pollMessages = async () => {
      try {
        const res = await fetch('/api/realtime/messages');
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(prev => {
              const prevMap = new Map(prev.map(m => [m.id, m]));
              let hasNew = false;
              data.messages.forEach((m: ChatMessage) => {
                if (!prevMap.has(m.id)) {
                  prevMap.set(m.id, m);
                  if (m.senderId !== loggedUser.id) {
                    hasNew = true;
                    // Instantly register this sender as ONLINE
                    setOnlinePresence(p => ({
                      userIds: new Set([...p.userIds, m.senderId]),
                      emails: new Set([...p.emails]),
                      names: new Set([...p.names, (m.senderName || '').toLowerCase()])
                    }));
                  }
                }
              });
              if (hasNew) playNotificationPing();
              return Array.from(prevMap.values());
            });
          }
        }
      } catch (e) {}
    };

    pollMessages();
    const interval = setInterval(pollMessages, 1500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [loggedUser.id]);

  useEffect(() => {
    let isSubscribed = true;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/realtime/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: loggedUser.id,
            email: loggedUser.email,
            nome: loggedUser.nome,
            status: userStatus
          })
        });

        if (bcRef.current) {
          bcRef.current.postMessage({
            type: 'PRESENCE_HEARTBEAT',
            payload: {
              userId: loggedUser.id,
              email: loggedUser.email,
              nome: loggedUser.nome,
              status: userStatus
            }
          });
        }
      } catch (e) {}
    };

    sendHeartbeat();
    fetchPresenceData();

    const hbInterval = setInterval(sendHeartbeat, 3000);
    const pollInterval = setInterval(fetchPresenceData, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(hbInterval);
      clearInterval(pollInterval);
      fetch('/api/realtime/presence/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loggedUser.id, email: loggedUser.email, nome: loggedUser.nome })
      }).catch(() => {});
    };
  }, [loggedUser.id, loggedUser.email, loggedUser.nome, userStatus]);

  const isUserOnline = (userOrId: Usuario | string | null | undefined): boolean => {
    if (!userOrId) return false;
    const now = Date.now();

    // Check if user has sent messages in the last 5 minutes (300,000 ms)
    const isRecentSender = (id?: string, name?: string) => {
      return messages.some(m => {
        const matchesId = id && (m.senderId === id || m.senderId?.toLowerCase() === id.toLowerCase());
        const matchesName = name && m.senderName?.toLowerCase() === name.toLowerCase();
        if (!matchesId && !matchesName) return false;
        const msgTime = m.createdAt || (m.timestamp ? Date.parse(`1970-01-01T${m.timestamp}:00Z`) || 0 : 0);
        return (now - msgTime) < 300000;
      });
    };

    if (typeof userOrId === 'string') {
      const clean = userOrId.trim();
      const cleanLower = clean.toLowerCase();
      if (
        clean === loggedUser.id ||
        (loggedUser.email && cleanLower === loggedUser.email.toLowerCase()) ||
        (loggedUser.nome && cleanLower === loggedUser.nome.toLowerCase())
      ) {
        return true;
      }
      if (isRecentSender(clean, cleanLower)) return true;
      return (
        onlinePresence.userIds.has(clean) ||
        onlinePresence.userIds.has(cleanLower) ||
        onlinePresence.emails.has(cleanLower) ||
        onlinePresence.names.has(cleanLower)
      );
    }

    const u = userOrId;
    if (
      u.id === loggedUser.id ||
      (u.email && loggedUser.email && u.email.toLowerCase() === loggedUser.email.toLowerCase()) ||
      (u.nome && loggedUser.nome && u.nome.toLowerCase() === loggedUser.nome.toLowerCase())
    ) {
      return true;
    }

    const uid = (u.id || '').trim();
    const uemail = (u.email || '').trim().toLowerCase();
    const unome = (u.nome || '').trim().toLowerCase();

    if (isRecentSender(uid, unome)) return true;

    return (
      onlinePresence.userIds.has(uid) ||
      onlinePresence.userIds.has(uid.toLowerCase()) ||
      (uemail !== '' && onlinePresence.emails.has(uemail)) ||
      (unome !== '' && onlinePresence.names.has(unome))
    );
  };

  // Start Audio Recording
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          setAttachmentPreview({
            type: 'file',
            url: base64Url,
            name: `Mensagem_de_Audio_${new Date().toLocaleTimeString('pt-PT').replace(/:/g, '-')}.webm`
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start();
      setIsRecordingAudio(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (e) {
      alert('Não foi possível aceder ao microfone. Verifique as permissões de áudio no seu navegador.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // Unified Call Signal Processors
  const processIncomingCallSignal = (sig: any) => {
    if (!sig || !sig.callId) return;
    if (handledCallIdsRef.current.has(sig.callId)) return;
    if (activeCallRef.current) return;

    const isForMe = sig.targetUserId === loggedUser.id || (!sig.targetUserId && sig.senderId !== loggedUser.id);
    if (isForMe && sig.senderId !== loggedUser.id) {
      setIncomingCallSignal(sig);
      if (ringStopRef.current) ringStopRef.current();
      ringStopRef.current = playRingTone();
      if (onAddNotification) {
        onAddNotification(
          '📞 Chamada de Entrada!',
          `${sig.callerName || 'Um colega'} está a ligar-lhe (${sig.type === 'video' ? 'Vídeo' : 'Voz'}).`,
          'warn'
        );
      }
    }
  };

  const processAcceptCallSignal = (sig: any) => {
    if (ringStopRef.current) ringStopRef.current();
    setIncomingCallSignal(null);
    setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null);
    }, 1000);
  };

  const processEndOrRejectCallSignal = (sig: any) => {
    if (sig?.callId) handledCallIdsRef.current.add(sig.callId);
    if (ringStopRef.current) ringStopRef.current();
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      try { remoteStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      remoteStreamRef.current = null;
    }
    setLocalStreamState(null);
    setRemoteStreamState(null);
    setActiveCall(null);
    setIncomingCallSignal(null);
  };

  // Initialize WebRTC CPaaS Media Engine via PeerJS
  useEffect(() => {
    let peerInstance: Peer | null = null;
    const cleanUserId = loggedUser.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const customPeerId = `gpa_crm_${cleanUserId}`;

    try {
      peerInstance = new Peer(customPeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        },
        debug: 1
      });

      peerRef.current = peerInstance;

      peerInstance.on('open', (id) => {
        setMyPeerId(id);
        setPeerConnected(true);
      });

      peerInstance.on('call', async (call) => {
        try {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: activeCallRef.current?.type === 'video',
              audio: { echoCancellation: true, noiseSuppression: true }
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
          mediaStreamRef.current = stream;
          setLocalStreamState(stream);
          call.answer(stream);

          call.on('stream', (remoteStream) => {
            if (remoteStream) {
              remoteStream.getAudioTracks().forEach(t => { t.enabled = true; });
            }
            remoteStreamRef.current = remoteStream;
            setRemoteStreamState(remoteStream);
          });
        } catch (e) {}
      });

      peerInstance.on('error', () => {
        setPeerConnected(false);
      });
    } catch (err) {
      console.error('PeerJS init notice:', err);
    }

    return () => {
      if (peerInstance) peerInstance.destroy();
    };
  }, [loggedUser.id]);

  // Video and audio stream element attachment
  useEffect(() => {
    if (!activeCall) return;

    const attachStreams = () => {
      const rStream = remoteStreamState || remoteStreamRef.current;
      const lStream = localStreamState || mediaStreamRef.current;

      if (rStream) {
        rStream.getAudioTracks().forEach(track => { track.enabled = true; });

        if (activeCall.type === 'video') {
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== rStream) {
            remoteVideoRef.current.srcObject = rStream;
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.play().catch(() => {});
          }
          if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
            remoteAudioRef.current.srcObject = null;
          }
        } else {
          if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== rStream) {
            remoteAudioRef.current.srcObject = rStream;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      }

      if (lStream) {
        lStream.getAudioTracks().forEach(track => { track.enabled = !activeCall.isMuted; });

        if (localVideoRef.current && localVideoRef.current.srcObject !== lStream) {
          localVideoRef.current.srcObject = lStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        }
      }
    };

    attachStreams();
    const interval = setInterval(attachStreams, 1000);
    return () => clearInterval(interval);
  }, [activeCall, remoteStreamState, localStreamState]);

  // Firebase Firestore Realtime Engine
  useEffect(() => {
    let unsubMessages: (() => void) | null = null;
    let unsubCalls: (() => void) | null = null;

    if (checkIsQuotaExhausted()) return;

    try {
      const messagesRef = query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(50));
      unsubMessages = onSnapshot(messagesRef, (snapshot) => {
        const firestoreMsgs: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          firestoreMsgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
        });

        if (firestoreMsgs.length > 0) {
          setMessages(prev => {
            const prevMap = new Map<string, ChatMessage>(prev.map(m => [m.id, m]));
            let hasNewRemoteMsg = false;

            firestoreMsgs.forEach(sm => {
              if (!prevMap.has(sm.id)) {
                prevMap.set(sm.id, sm);
                if (sm.senderId !== loggedUser.id) hasNewRemoteMsg = true;
              } else {
                const existing = prevMap.get(sm.id)!;
                if (JSON.stringify(existing.reactions) !== JSON.stringify(sm.reactions)) {
                  prevMap.set(sm.id, { ...existing, reactions: sm.reactions });
                }
              }
            });

            if (hasNewRemoteMsg) playNotificationPing();
            return Array.from(prevMap.values());
          });
        }
      }, () => {});

      const callsRef = query(collection(db, 'chat_call_signals'), orderBy('timestamp', 'desc'), limit(15));
      unsubCalls = onSnapshot(callsRef, (snapshot) => {
        const now = Date.now();
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const sig = change.doc.data();
            if (sig.timestamp && (now - sig.timestamp) > 45000) return;

            if (sig.type === 'INCOMING_CALL') processIncomingCallSignal(sig);
            else if (sig.type === 'ACCEPT_CALL') processAcceptCallSignal(sig);
            else if (sig.type === 'REJECT_CALL' || sig.type === 'END_CALL') processEndOrRejectCallSignal(sig);
          }
        });
      }, () => {});
    } catch (e) {}

    return () => {
      if (unsubMessages) unsubMessages();
      if (unsubCalls) unsubCalls();
    };
  }, [loggedUser.id]);

  // WebSocket Server listener
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isCancelled = false;

    const handleRealtimeEvent = (type: string, payload: any) => {
      if (!type) return;

      if (type === 'PRESENCE_HEARTBEAT' && payload) {
        setOnlinePresence(prev => ({
          userIds: new Set([...prev.userIds, payload.userId || ''].filter(Boolean)),
          emails: new Set([...prev.emails, (payload.email || '').toLowerCase()].filter(Boolean)),
          names: new Set([...prev.names, (payload.nome || '').toLowerCase()].filter(Boolean))
        }));
      }
      if (type === 'PRESENCE_OFFLINE' && payload) {
        setOnlinePresence(prev => {
          const nextU = new Set(prev.userIds);
          const nextE = new Set(prev.emails);
          const nextN = new Set(prev.names);
          if (payload.userId && payload.userId !== loggedUser.id) nextU.delete(payload.userId);
          if (payload.email && payload.email !== loggedUser.email) nextE.delete(payload.email.toLowerCase());
          if (payload.nome && payload.nome !== loggedUser.nome) nextN.delete(payload.nome.toLowerCase());
          return { userIds: nextU, emails: nextE, names: nextN };
        });
      }

      if (type === 'NEW_MESSAGE' && payload) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          if (payload.senderId !== loggedUser.id) playNotificationPing();
          return [...prev, payload];
        });
        if (payload.channelId !== activeChannelId && payload.senderId !== loggedUser.id) {
          setChannels(prev => prev.map(c => c.id === payload.channelId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c));
        }
      }

      if (type === 'INCOMING_CALL' && payload) processIncomingCallSignal(payload);
      if (type === 'ACCEPT_CALL' && payload) processAcceptCallSignal(payload);
      if ((type === 'REJECT_CALL' || type === 'END_CALL') && payload) processEndOrRejectCallSignal(payload);
      if (type === 'REACTION_UPDATE' && payload) {
        setMessages(prev => prev.map(m => m.id === payload.msgId ? { ...m, reactions: payload.reactions } : m));
      }
    };

    const connectWS = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const { type, payload } = data || {};
            handleRealtimeEvent(type, payload);
          } catch (err) {}
        };

        ws.onclose = () => {
          if (!isCancelled) reconnectTimer = setTimeout(connectWS, 3000);
        };
      } catch (err) {}
    };

    connectWS();

    // Attach Pusher bindings
    if (pusherClient) {
      const channel = pusherClient.subscribe('gpa-crm-channel');
      const events = ['PRESENCE_HEARTBEAT', 'PRESENCE_OFFLINE', 'NEW_MESSAGE', 'INCOMING_CALL', 'ACCEPT_CALL', 'REJECT_CALL', 'END_CALL', 'REACTION_UPDATE'];
      events.forEach(evt => {
        channel.bind(evt, (payload: any) => {
          handleRealtimeEvent(evt, payload);
        });
      });
    }

    // Attach Ably bindings
    let ablyChannel: any = null;
    if (ablyClient) {
      ablyChannel = ablyClient.channels.get('gpa-crm-channel');
      ablyChannel.subscribe((message: any) => {
        handleRealtimeEvent(message.name, message.data);
      });
    }

    return () => {
      isCancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      if (pusherClient) pusherClient.unsubscribe('gpa-crm-channel');
      if (ablyChannel) ablyChannel.unsubscribe();
    };
  }, [loggedUser.id, activeChannelId]);

  // BroadcastChannel for cross-tab realtime sync
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('gpa_realtime_chat_channel_v4');
        bcRef.current = channel;

        channel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (!type) return;

          if (type === 'PRESENCE_HEARTBEAT' && payload) {
            setOnlinePresence(prev => ({
              userIds: new Set([...prev.userIds, payload.userId || ''].filter(Boolean)),
              emails: new Set([...prev.emails, (payload.email || '').toLowerCase()].filter(Boolean)),
              names: new Set([...prev.names, (payload.nome || '').toLowerCase()].filter(Boolean))
            }));
          }
          if (type === 'PRESENCE_OFFLINE' && payload) {
            setOnlinePresence(prev => {
              const nextU = new Set(prev.userIds);
              const nextE = new Set(prev.emails);
              const nextN = new Set(prev.names);
              if (payload.userId && payload.userId !== loggedUser.id) nextU.delete(payload.userId);
              if (payload.email && payload.email !== loggedUser.email) nextE.delete(payload.email.toLowerCase());
              if (payload.nome && payload.nome !== loggedUser.nome) nextN.delete(payload.nome.toLowerCase());
              return { userIds: nextU, emails: nextE, names: nextN };
            });
          }

          if (type === 'NEW_MESSAGE' && payload) {
            setMessages(prev => {
              if (prev.some(m => m.id === payload.id)) return prev;
              if (payload.senderId !== loggedUser.id) playNotificationPing();
              return [...prev, payload];
            });
            if (payload.channelId !== activeChannelId && payload.senderId !== loggedUser.id) {
              setChannels(prev => prev.map(c => c.id === payload.channelId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c));
            }
          }

          if (type === 'INCOMING_CALL' && payload) processIncomingCallSignal(payload);
          if (type === 'ACCEPT_CALL' && payload) processAcceptCallSignal(payload);
          if ((type === 'REJECT_CALL' || type === 'END_CALL') && payload) processEndOrRejectCallSignal(payload);
          if (type === 'REACTION_UPDATE' && payload) {
            setMessages(prev => prev.map(m => m.id === payload.msgId ? { ...m, reactions: payload.reactions } : m));
          }
        };
      }
    } catch (e) {}

    return () => {
      if (bcRef.current) bcRef.current.close();
    };
  }, [loggedUser.id, activeChannelId]);

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('gpa_chat_messages', JSON.stringify(messages));
      localStorage.setItem('gpa_chat_channels', JSON.stringify(channels));
    } catch (e) {}
  }, [messages, channels]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannelId]);

  // Last read per channel
  const [lastReadTimes, setLastReadTimes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('gpa_chat_last_read');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('gpa_chat_last_read', JSON.stringify(lastReadTimes));
    } catch (e) {}
  }, [lastReadTimes]);

  useEffect(() => {
    if (activeChannelId) {
      setLastReadTimes(prev => ({ ...prev, [activeChannelId]: Date.now() }));
    }
  }, [activeChannelId]);

  const getDMInfo = (targetUser: Usuario) => {
    const dmId = getDMChannelId(loggedUser.id, targetUser.id);
    const dmMessages = messages.filter(m => m.channelId === dmId);
    const lastMsg = dmMessages.length > 0 ? dmMessages[dmMessages.length - 1] : null;
    const lastRead = lastReadTimes[dmId] || 0;

    const isCurrentActive = activeDMUser?.id === targetUser.id || activeChannelId === dmId;
    const unreadCount = isCurrentActive ? 0 : dmMessages.filter(m => {
      if (m.senderId === loggedUser.id) return false;
      const msgTime = m.createdAt || (m.timestamp ? Date.parse(`1970-01-01T${m.timestamp}:00Z`) || 0 : 0);
      return msgTime > lastRead;
    }).length;

    return { dmId, dmMessages, lastMsg, unreadCount };
  };

  const handleSelectDM = (user: Usuario) => {
    setActiveDMUser(user);
    const dmId = getDMChannelId(loggedUser.id, user.id);
    setActiveChannelId(dmId);
    setLastReadTimes(prev => ({ ...prev, [dmId]: Date.now() }));
    setMobileShowChat(true);
  };

  const handleSelectGroupChannel = (ch: ChatChannel) => {
    setActiveDMUser(null);
    setActiveChannelId(ch.id);
    setLastReadTimes(prev => ({ ...prev, [ch.id]: Date.now() }));
    setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, unreadCount: 0 } : c));
    setMobileShowChat(true);
  };

  const currentMessages = messages.filter(m => m.channelId === activeChannelId);

  const broadcastRealtimeToAll = (type: string, payload: any) => {
    if (ablyClient) {
      try {
        const channel = ablyClient.channels.get("gpa-crm-channel");
        channel.publish(type, payload);
      } catch (e) {}
    }

    if (type === 'NEW_MESSAGE') {
      fetch('/api/realtime/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } else if (type === 'REACTION_UPDATE') {
      fetch('/api/realtime/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } else {
      fetch('/api/realtime/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, type })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type, payload })); } catch (e) {}
    }

    if (bcRef.current) {
      try { bcRef.current.postMessage({ type, payload }); } catch (e) {}
    }
  };

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachmentPreview) return;

    const now = Date.now();
    const newMsg: ChatMessage = {
      id: `m_${now}_${Math.random().toString(36).substring(2, 6)}`,
      channelId: activeChannelId,
      senderId: loggedUser.id,
      senderName: loggedUser.nome,
      senderAvatar: loggedUser.foto,
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      createdAt: now,
      attachment: attachmentPreview || undefined
    };

    setMessages(prev => sortMessages([...prev, newMsg]));
    setInputText('');
    setAttachmentPreview(null);
    setShowEmojiPicker(false);
    setLastReadTimes(prev => ({ ...prev, [activeChannelId]: now }));

    broadcastRealtimeToAll('NEW_MESSAGE', newMsg);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const url = evt.target?.result as string;
      const isImg = file.type.startsWith('image/');
      setAttachmentPreview({
        type: isImg ? 'image' : 'file',
        url,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  // Start Call
  const handleStartCall = async (type: 'audio' | 'video') => {
    const targetName = activeDMUser
      ? activeDMUser.nome
      : (channels.find(c => c.id === activeChannelId)?.name || 'Equipa GPA');

    const callId = `call_${Date.now()}`;

    setActiveCall({
      callId,
      isOpen: true,
      type,
      callerName: targetName,
      status: 'calling',
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      isFullscreen: false
    });

    if (ringStopRef.current) ringStopRef.current();
    ringStopRef.current = playRingTone();

    const callSignal = {
      callId,
      senderId: loggedUser.id,
      callerId: loggedUser.id,
      callerName: loggedUser.nome,
      callerFoto: loggedUser.foto,
      type,
      channelId: activeChannelId,
      targetUserId: activeDMUser?.id
    };

    broadcastRealtimeToAll('INCOMING_CALL', callSignal);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video' ? { facingMode: 'user' } : false,
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;
      setLocalStreamState(stream);

      if (peerRef.current && activeDMUser && stream) {
        const targetPeerId = `gpa_crm_${activeDMUser.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const call = peerRef.current.call(targetPeerId, stream);
        if (call) {
          activeMediaCallRef.current = call;
          call.on('stream', (remoteStream) => {
            if (remoteStream) {
              remoteStream.getAudioTracks().forEach(t => { t.enabled = true; });
            }
            remoteStreamRef.current = remoteStream;
            setRemoteStreamState(remoteStream);
          });
        }
      }
    } catch (err) {
      console.warn('Permissão de multimédia:', err);
    }

    if (onLogOperation) {
      onLogOperation('chamada', 'chat', type, `Chamada de ${type} iniciada com ${targetName}`);
    }
  };

  const handleAnswerIncomingCall = async () => {
    if (!incomingCallSignal) return;
    if (ringStopRef.current) ringStopRef.current();

    const signal = incomingCallSignal;
    handledCallIdsRef.current.add(signal.callId);
    setIncomingCallSignal(null);

    setActiveCall({
      callId: signal.callId,
      isOpen: true,
      type: signal.type,
      callerName: signal.callerName,
      status: 'connected',
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      isFullscreen: false
    });

    broadcastRealtimeToAll('ACCEPT_CALL', { callId: signal.callId, responderId: loggedUser.id });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: signal.type === 'video' ? { facingMode: 'user' } : false,
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;
      setLocalStreamState(stream);

      if (peerRef.current && signal.callerId && stream) {
        const targetPeerId = `gpa_crm_${signal.callerId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const call = peerRef.current.call(targetPeerId, stream);
        if (call) {
          activeMediaCallRef.current = call;
          call.on('stream', (remoteStream) => {
            if (remoteStream) {
              remoteStream.getAudioTracks().forEach(t => { t.enabled = true; });
            }
            remoteStreamRef.current = remoteStream;
            setRemoteStreamState(remoteStream);
          });
        }
      }
    } catch (e) {}

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null);
    }, 1000);
  };

  const handleRejectIncomingCall = () => {
    if (!incomingCallSignal) return;
    if (ringStopRef.current) ringStopRef.current();
    handledCallIdsRef.current.add(incomingCallSignal.callId);
    broadcastRealtimeToAll('REJECT_CALL', { callId: incomingCallSignal.callId, responderId: loggedUser.id });
    setIncomingCallSignal(null);
  };

  const handleEndCall = () => {
    if (ringStopRef.current) ringStopRef.current();
    if (callTimerRef.current) clearInterval(callTimerRef.current);

    if (activeCall?.callId) {
      handledCallIdsRef.current.add(activeCall.callId);
      broadcastRealtimeToAll('END_CALL', { callId: activeCall.callId, fromUserId: loggedUser.id });
    }

    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      try { remoteStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      remoteStreamRef.current = null;
    }

    setLocalStreamState(null);
    setRemoteStreamState(null);

    if (activeCall && activeCall.duration > 0) {
      const formattedDur = formatDuration(activeCall.duration);
      const sysMsg: ChatMessage = {
        id: `m_sys_${Date.now()}`,
        channelId: activeChannelId,
        senderId: 'system',
        senderName: 'Sistema',
        text: `📞 Chamada de ${activeCall.type === 'video' ? 'vídeo' : 'voz'} terminada (${formattedDur})`,
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        isSystem: true
      };
      setMessages(prev => [...prev, sysMsg]);
      broadcastRealtimeToAll('NEW_MESSAGE', sysMsg);
    }

    setActiveCall(null);
  };

  const handleToggleMute = () => {
    if (!activeCall) return;
    const nextMuted = !activeCall.isMuted;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(t => t.enabled = !nextMuted);
    }
    setActiveCall({ ...activeCall, isMuted: nextMuted });
  };

  const handleToggleCamera = () => {
    if (!activeCall) return;
    const nextCam = !activeCall.isCameraOff;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(t => t.enabled = !nextCam);
    }
    setActiveCall({ ...activeCall, isCameraOff: nextCam });
  };

  const handleSwitchToVideo = async () => {
    if (!activeCall) return;
    try {
      const vStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      mediaStreamRef.current = vStream;
      setLocalStreamState(vStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = vStream;
      setActiveCall({ ...activeCall, type: 'video', isCameraOff: false });
    } catch (err) {
      alert('Não foi possível ativar a câmara.');
    }
  };

  const handleSwitchToAudio = () => {
    if (!activeCall) return;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(t => t.stop());
    }
    setActiveCall({ ...activeCall, type: 'audio' });
  };

  const handleAddReaction = (msgId: string, emoji: string) => {
    let updatedRx: Record<string, string[]> = {};
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const rx = { ...(m.reactions || {}) };
      const list = rx[emoji] || [];
      if (list.includes(loggedUser.id)) {
        rx[emoji] = list.filter(id => id !== loggedUser.id);
        if (rx[emoji].length === 0) delete rx[emoji];
      } else {
        rx[emoji] = [...list, loggedUser.id];
      }
      updatedRx = rx;
      return { ...m, reactions: rx };
    }));

    broadcastRealtimeToAll('REACTION_UPDATE', { msgId, reactions: updatedRx });
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Group creation
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const cleanName = newGroupName.toLowerCase().replace(/\s+/g, '-');
    const newCh: ChatChannel = {
      id: `c_group_${Date.now()}`,
      name: cleanName,
      description: newGroupDesc || 'Canal da equipa GPA',
      isGroup: true,
      unreadCount: 0
    };

    setChannels(prev => [...prev, newCh]);
    setActiveChannelId(newCh.id);
    setActiveDMUser(null);
    setShowNewGroupModal(false);
    setNewGroupName('');
    setNewGroupDesc('');
  };

  const activeTitle = activeDMUser
    ? activeDMUser.nome
    : (channels.find(c => c.id === activeChannelId)?.name || 'Chat Interno');

  // Filtered users
  const rawFilteredUsers = useMemo(() => {
    return comerciais.filter(c =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.funcao?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [comerciais, searchTerm]);

  const onlineCount = useMemo(() => {
    return comerciais.filter(u => u.id !== loggedUser.id && isUserOnline(u)).length;
  }, [comerciais, onlinePresence, loggedUser.id]);

  const offlineCount = useMemo(() => {
    return comerciais.filter(u => u.id !== loggedUser.id && !isUserOnline(u)).length;
  }, [comerciais, onlinePresence, loggedUser.id]);

  const filteredUsers = useMemo(() => {
    return rawFilteredUsers.filter(u => {
      if (presenceFilter === 'online') return isUserOnline(u);
      if (presenceFilter === 'offline') return !isUserOnline(u);
      return true;
    });
  }, [rawFilteredUsers, presenceFilter, onlinePresence]);

  return (
    <>
      <div className={`h-[calc(100vh-100px)] min-h-[580px] bg-slate-950/95 rounded-3xl border border-cyan-500/30 shadow-2xl overflow-hidden text-left font-sans relative backdrop-blur-2xl ${!activeTab || activeTab === 'chat' ? 'flex' : 'hidden'}`}>
        
        {/* LEFT SIDEBAR: Channels, Presence & Contact List */}
        <div className={`w-full md:w-84 bg-slate-950/90 text-slate-100 flex flex-col border-r border-cyan-500/20 shrink-0 backdrop-blur-xl z-10 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          
          {/* User Status Bar */}
          <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-900/80 shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <UserAvatar name={loggedUser.nome} foto={loggedUser.foto} size="md" />
                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                  userStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse' :
                  userStatus === 'ausente' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-white leading-tight truncate max-w-[135px]">{loggedUser.nome}</h3>
                <p className="text-[10px] text-cyan-300 font-bold capitalize flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {loggedUser.perfil || 'Comercial'}
                </p>
              </div>
            </div>

            <div className="relative">
              <select
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value as any)}
                className="bg-slate-950 text-slate-200 text-[11px] font-bold py-1.5 px-2.5 rounded-xl border border-cyan-500/30 cursor-pointer focus:outline-none focus:border-cyan-400 shadow-inner"
              >
                <option value="online">🟢 Online</option>
                <option value="ausente">🟡 Ausente</option>
                <option value="ocupado">🔴 Ocupado</option>
              </select>
            </div>
          </div>

          {/* Search Input & Live Presence Sync */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3 text-cyan-400/70" />
                <input
                  type="text"
                  placeholder="Pesquisar contacto ou canal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/90 text-slate-100 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-cyan-500/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20 placeholder-slate-400"
                />
              </div>
              <button
                onClick={fetchPresenceData}
                className="p-2.5 bg-slate-900 hover:bg-slate-850 text-cyan-400 hover:text-cyan-300 rounded-xl border border-cyan-500/20 transition cursor-pointer shrink-0"
                title="Sincronizar Presença Online"
              >
                <Activity size={14} />
              </button>
            </div>

            {/* Filter Pills Bar: Todos / Online / Offline / Canais */}
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setPresenceFilter('todos')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap cursor-pointer ${
                  presenceFilter === 'todos'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Todos ({rawFilteredUsers.filter(u => u.id !== loggedUser.id).length})
              </button>

              <button
                onClick={() => setPresenceFilter('online')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  presenceFilter === 'online'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-900/60 text-emerald-400 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]"></span>
                Online ({onlineCount})
              </button>

              <button
                onClick={() => setPresenceFilter('offline')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  presenceFilter === 'offline'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                    : 'bg-slate-900/60 text-red-400 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Offline ({offlineCount})
              </button>

              <button
                onClick={() => setPresenceFilter('canais')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap cursor-pointer ${
                  presenceFilter === 'canais'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                # Canais ({channels.length})
              </button>
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            
            {/* Group Channels (Show when filter is 'todos' or 'canais') */}
            {(presenceFilter === 'todos' || presenceFilter === 'canais') && (
              <div>
                <div className="flex items-center justify-between text-[10px] font-black text-cyan-300 uppercase tracking-wider mb-2 px-1">
                  <span className="flex items-center gap-1.5"><Hash size={13} /> Canais Oficiais ({channels.length})</span>
                  <button
                    onClick={() => setShowNewGroupModal(true)}
                    className="p-1 rounded-lg hover:bg-cyan-500/20 text-cyan-300 hover:text-white transition cursor-pointer"
                    title="Criar Novo Canal"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {channels.map(ch => {
                    const isActive = !activeDMUser && activeChannelId === ch.id;
                    const hasUnread = (ch.unreadCount || 0) > 0 && !isActive;

                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleSelectGroupChannel(ch)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                          hasUnread
                            ? 'bg-gradient-to-r from-amber-950/95 via-rose-950/90 to-amber-950/95 text-white shadow-xl shadow-amber-500/25 border-2 border-amber-400 ring-2 ring-amber-400/40 animate-pulse'
                            : isActive
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/40'
                            : 'text-slate-300 hover:bg-slate-900/90 hover:text-white border border-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            hasUnread ? 'bg-amber-400 text-slate-950 font-black animate-bounce' : isActive ? 'bg-white/20' : 'bg-slate-800 text-cyan-400'
                          }`}>
                            <Hash size={14} />
                          </div>
                          <div className="truncate text-left">
                            <span className={`truncate block ${hasUnread ? 'text-amber-200 font-black' : 'text-slate-100 font-bold'}`}>{ch.name}</span>
                            {hasUnread && <span className="text-[10px] text-amber-300 font-extrabold">🔔 Novas mensagens no canal</span>}
                          </div>
                        </div>

                        {hasUnread && (
                          <span className="bg-gradient-to-r from-amber-500 to-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-lg shadow-amber-500/50 flex items-center gap-1 border border-white/30 animate-bounce">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            {ch.unreadCount} NOVAS
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Messages & Contacts */}
            {presenceFilter !== 'canais' && (
              <div>
                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1">
                  <span className="flex items-center gap-1.5">
                    <Users size={13} className="text-cyan-400" />
                    Contactos & Comerciais ({filteredUsers.filter(u => u.id !== loggedUser.id).length})
                  </span>
                </div>

                <div className="space-y-2">
                  {filteredUsers
                    .filter(user => user.id !== loggedUser.id)
                    .sort((a, b) => {
                      const infoA = getDMInfo(a);
                      const infoB = getDMInfo(b);
                      if (infoA.unreadCount > 0 && infoB.unreadCount === 0) return -1;
                      if (infoB.unreadCount > 0 && infoA.unreadCount === 0) return 1;
                      const onlineA = isUserOnline(a);
                      const onlineB = isUserOnline(b);
                      if (onlineA && !onlineB) return -1;
                      if (!onlineA && onlineB) return 1;
                      return (infoB.lastMsg?.createdAt || 0) - (infoA.lastMsg?.createdAt || 0);
                    })
                    .map(user => {
                      const { lastMsg, unreadCount } = getDMInfo(user);
                      const isActive = activeDMUser?.id === user.id;
                      const userOnline = isUserOnline(user);
                      const hasUnread = unreadCount > 0 && !isActive;

                      let snippet = user.funcao || 'Comercial GPA';
                      if (lastMsg) {
                        const prefix = lastMsg.senderId === loggedUser.id ? 'Você: ' : '';
                        if (lastMsg.text) {
                          snippet = prefix + lastMsg.text;
                        } else if (lastMsg.attachment) {
                          snippet = prefix + (lastMsg.attachment.type === 'image' ? '📷 Foto' : '📄 Ficheiro');
                        }
                      }

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleSelectDM(user)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-medium transition-all duration-300 cursor-pointer ${
                            hasUnread
                              ? 'bg-gradient-to-r from-amber-950/95 via-orange-950/90 to-rose-950/95 text-white shadow-2xl shadow-amber-500/35 border-2 border-amber-400 ring-2 ring-amber-400/50 animate-pulse'
                              : isActive
                              ? 'bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white shadow-lg border border-cyan-400/50 ring-1 ring-cyan-500/20'
                              : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border border-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-2">
                            {/* Avatar with Online (🟢 Verde) / Offline (🔴 Vermelho) indicator */}
                            <div className="relative shrink-0">
                              <UserAvatar name={user.nome} foto={user.foto} size="md" />
                              
                              {/* Online / Offline status dot */}
                              <span
                                title={userOnline ? 'Utilizador Online' : 'Utilizador Offline'}
                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                                  userOnline
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                                    : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.7)]'
                                }`}
                              />

                              {/* Unread Bell Badge on Avatar */}
                              {hasUnread && (
                                <span className="absolute -top-1 -left-1 w-4.5 h-4.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-black text-[10px] flex items-center justify-center border-2 border-slate-950 shadow-lg animate-bounce">
                                  🔔
                                </span>
                              )}
                            </div>

                            <div className="text-left truncate flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`font-black text-xs leading-tight truncate flex items-center gap-1.5 ${
                                  hasUnread ? 'text-amber-300 text-[13px]' : isActive ? 'text-white' : 'text-slate-100'
                                }`}>
                                  {hasUnread && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0"></span>}
                                  {user.nome}
                                </p>
                                {lastMsg && (
                                  <span className={`text-[9px] shrink-0 font-mono ${hasUnread ? 'text-amber-300 font-black' : 'text-slate-400'}`}>
                                    {lastMsg.timestamp}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-1 mt-1">
                                <p className={`text-[10px] truncate flex-1 ${
                                  hasUnread ? 'text-amber-100 font-bold' : 'text-slate-400'
                                }`}>
                                  {snippet}
                                </p>
                                
                                {/* Online / Offline Tag Pill */}
                                {userOnline ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                    Online
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase text-red-400/90 bg-red-500/10 border border-red-500/20 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Offline
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Unread Alert Pill Badge */}
                          {hasUnread && (
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                              <span className="bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 text-white font-black text-[10px] px-2.5 py-1 rounded-xl shadow-lg shadow-amber-500/50 flex items-center gap-1 border border-white/30 animate-bounce">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                {unreadCount} {unreadCount === 1 ? 'NOVA' : 'NOVAS'}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* RIGHT MAIN CHAT WINDOW - Ultra-Modern Dark Glassmorphism */}
        <div className={`flex-1 flex flex-col bg-[#070d19] relative overflow-hidden ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Subtle Ambient Tech Mesh Overlay */}
          <div className="absolute inset-0 bg-tech-grid opacity-15 pointer-events-none z-0"></div>
          <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none z-0"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none z-0"></div>

          {/* Chat Header */}
          <div className="h-18 px-4 sm:px-6 bg-slate-900/90 border-b border-cyan-500/20 flex items-center justify-between shrink-0 shadow-xl backdrop-blur-xl z-10">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* Mobile Back Button */}
              <button
                onClick={() => setMobileShowChat(false)}
                className="md:hidden p-2 text-cyan-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
                title="Voltar aos contactos"
              >
                <ArrowLeft size={20} />
              </button>

              {activeDMUser ? (
                <div className="relative shrink-0">
                  <UserAvatar name={activeDMUser.nome} foto={activeDMUser.foto} size="md" />
                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                      isUserOnline(activeDMUser)
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center font-black shadow-lg shadow-cyan-500/20 shrink-0">
                  <Hash size={22} />
                </div>
              )}

              <div className="min-w-0 truncate">
                <div className="flex items-center gap-2 truncate">
                  <h2 className="text-sm sm:text-base font-black text-white capitalize truncate">
                    {activeDMUser ? activeDMUser.nome : `#${activeTitle}`}
                  </h2>

                  {/* Online/Offline Badge for DM */}
                  {activeDMUser && (
                    isUserOnline(activeDMUser) ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 shadow-sm shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        🟢 Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase text-red-400 bg-red-500/15 border border-red-500/30 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        🔴 Offline
                      </span>
                    )
                  )}

                  <button
                    onClick={() => setShowCPaaSModal(true)}
                    className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-950 text-cyan-300 border border-cyan-500/30 hover:bg-slate-800 transition cursor-pointer shrink-0"
                    title="Ver Estado CPaaS WebRTC"
                  >
                    <Radio size={12} className={peerConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'} />
                    <span>CPaaS: {peerConnected ? 'Ativo' : 'A Conectar...'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  {activeDMUser
                    ? (activeDMUser.funcao ? `${activeDMUser.funcao} • ${activeDMUser.email}` : 'Comercial GPA Angola')
                    : (channels.find(c => c.id === activeChannelId)?.description || 'Canal de comunicação da equipa')}
                </p>
              </div>
            </div>

            {/* Action Buttons: Voice Call & Video Call */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleStartCall('audio')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-black flex items-center gap-2 border border-emerald-500/40 transition duration-200 shadow-md hover:shadow-emerald-500/20 cursor-pointer"
                title="Iniciar Chamada de Voz"
              >
                <Phone size={15} className="text-emerald-400" />
                <span className="hidden sm:inline">Voz</span>
              </button>

              <button
                onClick={() => handleStartCall('video')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition duration-200 shadow-lg shadow-cyan-500/25 border border-cyan-300/40 cursor-pointer"
                title="Iniciar Vídeo Chamada HD"
              >
                <Video size={15} />
                <span className="hidden sm:inline">Vídeo Chamada</span>
              </button>
            </div>
          </div>

          {/* Messages Feed Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar z-10">
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-900/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl">
                  <MessageSquare size={32} />
                </div>
                <p className="text-sm font-black text-white">Nenhuma mensagem neste canal ainda.</p>
                <p className="text-xs text-slate-400 max-w-sm">Escreva uma mensagem de texto, envie uma nota de voz ou inicie uma videochamada.</p>
              </div>
            ) : (
              currentMessages.map((msg) => {
                const isMine = msg.senderId === loggedUser.id;

                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-3">
                      <span className="bg-slate-900/90 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md">
                        <Activity size={13} className="text-emerald-400" />
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'} group`}>
                    {!isMine && (
                      <div className="relative shrink-0 self-end mb-1">
                        <UserAvatar name={msg.senderName} foto={msg.senderAvatar} size="sm" />
                      </div>
                    )}

                    <div className={`max-w-[85%] sm:max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-black text-slate-300">{msg.senderName}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          {msg.timestamp}
                          {isMine && <span className="text-cyan-400 font-bold" title="Entregue em tempo real">✓✓</span>}
                        </span>
                      </div>

                      <div className={`p-4 rounded-3xl text-xs font-medium space-y-2.5 shadow-xl backdrop-blur-md ${
                        isMine
                          ? 'bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 text-white rounded-tr-xs shadow-cyan-500/20 border border-cyan-300/40'
                          : 'bg-slate-900/90 text-slate-100 border border-slate-800 rounded-tl-xs'
                      }`}>
                        {msg.text && <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-[13px]">{msg.text}</p>}

                        {msg.attachment && (
                          <div className="mt-2 rounded-2xl overflow-hidden border border-white/15 max-w-sm bg-black/40 p-2">
                            {msg.attachment.type === 'image' ? (
                              <img src={msg.attachment.url} alt="anexo" className="max-h-64 w-full object-cover rounded-xl" />
                            ) : (msg.attachment.name?.toLowerCase().includes('audio') || msg.attachment.url?.startsWith('data:audio') || msg.attachment.name?.endsWith('.webm') || msg.attachment.name?.endsWith('.mp3')) ? (
                              <div className="p-3 space-y-1.5 bg-slate-950/80 rounded-xl border border-cyan-500/30">
                                <div className="flex items-center gap-2 text-xs font-black text-cyan-300">
                                  <Mic size={15} className="text-emerald-400 animate-pulse" />
                                  <span>Mensagem de Áudio</span>
                                </div>
                                <audio controls src={msg.attachment.url} className="w-full h-9 rounded-lg" />
                              </div>
                            ) : (
                              <div className="p-3 flex items-center justify-between gap-3 text-xs font-bold text-white bg-slate-950/80 rounded-xl">
                                <div className="flex items-center gap-2 truncate">
                                  <FileText size={18} className="text-cyan-400 shrink-0" />
                                  <span className="truncate">{msg.attachment.name}</span>
                                </div>
                                <a
                                  href={msg.attachment.url}
                                  download={msg.attachment.name}
                                  className="p-1.5 bg-slate-800 hover:bg-cyan-600 rounded-lg transition text-white shrink-0"
                                >
                                  <Download size={14} />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reactions list */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.entries(msg.reactions).map(([emoji, uids]) => (
                              <button
                                key={emoji}
                                onClick={() => handleAddReaction(msg.id, emoji)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                  isMine ? 'bg-white/25 text-white' : 'bg-slate-800/80 text-cyan-300 border border-slate-700'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{(uids as string[]).length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick Reaction Bar on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 px-1 bg-slate-900/90 rounded-full px-2 py-0.5 border border-slate-800 shadow-md">
                        {['👍', '❤️', '🚀', '👏', '💼', '🔥'].map(e => (
                          <button
                            key={e}
                            onClick={() => handleAddReaction(msg.id, e)}
                            className="hover:scale-130 transition text-xs p-1 cursor-pointer"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Preview Bar */}
          {attachmentPreview && (
            <div className="px-6 py-2.5 bg-slate-900 border-t border-cyan-500/30 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 text-xs font-black text-cyan-300">
                {attachmentPreview.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                <span>Anexo pronto: {attachmentPreview.name}</span>
              </div>
              <button onClick={() => setAttachmentPreview(null)} className="text-slate-400 hover:text-red-400 transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Message Composer Footer */}
          <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-cyan-500/20 shrink-0 z-10">
            {isRecordingAudio ? (
              <div className="flex items-center justify-between bg-red-950/70 border border-red-500/40 p-3.5 rounded-2xl animate-pulse shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-black text-red-200 font-mono">
                    A gravar áudio em direto: {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelAudioRecording}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={stopAudioRecording}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 size={14} /> Concluir e Enviar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-cyan-500/30 shadow-2xl backdrop-blur-xl">
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
                  title="Anexar Ficheiro ou Imagem"
                >
                  <Paperclip size={18} />
                </button>

                <button
                  type="button"
                  onClick={startAudioRecording}
                  className="p-2.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 rounded-xl transition cursor-pointer shrink-0"
                  title="Gravar Mensagem de Áudio"
                >
                  <Mic size={18} />
                </button>

                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={`Escreva uma mensagem para #${activeTitle}...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full bg-transparent text-white text-xs sm:text-sm px-3 py-2.5 focus:outline-none placeholder-slate-500"
                  />

                  {/* Emoji Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                  >
                    <Smile size={18} />
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute right-0 bottom-12 bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-3 grid grid-cols-6 gap-2 z-50 backdrop-blur-2xl">
                      {['👍', '❤️', '🚀', '👏', '💼', '✅', '🔥', '📊', '🤝', '🎯', '📍', '💡'].map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setInputText(prev => prev + e);
                            setShowEmojiPicker(false);
                          }}
                          className="text-lg p-1.5 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() && !attachmentPreview}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 disabled:opacity-35 text-white font-black rounded-xl text-xs flex items-center gap-2 transition duration-200 shadow-lg shadow-cyan-500/25 cursor-pointer shrink-0"
                >
                  <span>Enviar</span>
                  <Send size={14} />
                </button>
              </form>
            )}
          </div>

        </div>

      </div>

      {/* CREATE NEW GROUP MODAL */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[2000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl text-left border border-cyan-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Hash size={18} className="text-cyan-400" />
                Criar Novo Canal de Equipa
              </h3>
              <button onClick={() => setShowNewGroupModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                  Nome do Canal:
                </label>
                <input
                  type="text"
                  placeholder="ex: vendas-grandes-contas"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-xl focus:outline-none focus:border-cyan-400 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                  Descrição do Canal:
                </label>
                <input
                  type="text"
                  placeholder="Objetivo e tópicos de discussão"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-xl focus:outline-none focus:border-cyan-400 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewGroupModal(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl text-xs font-black shadow-lg shadow-cyan-500/25 hover:from-blue-500 hover:to-cyan-500 transition cursor-pointer"
                >
                  Criar Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INCOMING CALL MODAL POPUP */}
      {incomingCallSignal && (
        <div className="fixed inset-0 bg-slate-950/90 z-[4000] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-7 text-center space-y-6 border border-cyan-500/40 shadow-2xl relative overflow-hidden">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center relative">
              <UserAvatar name={incomingCallSignal.callerName} foto={incomingCallSignal.callerFoto} size="lg" />
              <span className="absolute -inset-3 rounded-full border-2 border-emerald-500/60 animate-ping" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">{incomingCallSignal.callerName}</h3>
              <p className="text-xs text-emerald-400 font-black mt-1 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {incomingCallSignal.type === 'video' ? 'Chamada de Vídeo HD Entrante...' : 'Chamada de Voz Entrante...'}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex items-center justify-center gap-8">
                <button
                  onClick={handleRejectIncomingCall}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-bold shadow-lg shadow-red-500/30 cursor-pointer transition transform hover:scale-110"
                  title="Recusar Chamada"
                >
                  <PhoneOff size={22} />
                </button>

                <button
                  onClick={handleAnswerIncomingCall}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/30 cursor-pointer transition transform hover:scale-110 animate-pulse"
                  title="Atender Chamada"
                >
                  {incomingCallSignal.type === 'video' ? <Video size={22} /> : <Phone size={22} />}
                </button>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('chat')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline mt-2 cursor-pointer transition"
                >
                  💬 Abrir Chat no Fundo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CALL OVERLAY MODAL (AUDIO & VIDEO CALL ENGINE) */}
      {activeCall && (
        <div className="fixed inset-0 bg-slate-950/95 z-[3000] flex items-center justify-center p-0 sm:p-4 backdrop-blur-2xl animate-fade-in">
          <div className="bg-slate-900 text-white rounded-none sm:rounded-3xl max-w-2xl w-full h-full sm:h-[540px] p-4 sm:p-6 flex flex-col justify-between border-0 sm:border border-cyan-500/40 shadow-2xl relative overflow-hidden">
            
            {/* Top Call Status Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-lg">
                  {activeCall.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{activeCall.callerName}</h3>
                  <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {activeCall.status === 'calling' ? 'A chamar colega...' : `Em Chamada HD (${formatDuration(activeCall.duration)})`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleEndCall}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Video / Audio Visualizer Area */}
            <div className="flex-1 my-4 bg-slate-950 rounded-2xl border border-cyan-500/20 relative flex items-center justify-center overflow-hidden shadow-inner">
              <audio ref={remoteAudioRef} autoPlay playsInline />

              {activeCall.type === 'video' ? (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 -z-10">
                    <UserAvatar name={activeCall.callerName} size="lg" />
                    <p className="text-xs font-bold text-cyan-300 animate-pulse">A sincronizar sinal de vídeo...</p>
                  </div>

                  {/* Picture in Picture */}
                  <div className="absolute bottom-4 right-4 w-36 h-28 rounded-2xl border-2 border-cyan-500/50 shadow-2xl overflow-hidden bg-slate-900 z-20">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${activeCall.isCameraOff ? 'hidden' : 'block'}`}
                    />
                    {activeCall.isCameraOff && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2 text-center">
                        <CameraOff size={18} />
                        <span className="text-[9px] font-bold mt-1">Câmara Desligada</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 left-4 bg-slate-900/85 border border-cyan-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 backdrop-blur-md shadow-lg z-20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black text-white">{activeCall.callerName}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <UserAvatar name={activeCall.callerName} size="lg" />
                    <span className="absolute -inset-3 rounded-full border-2 border-emerald-500/40 animate-ping" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-black text-white">{activeCall.callerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Chamada de Voz de Alta Definição Ativa</p>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mt-2 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full shadow-md">
                      <ShieldCheck size={13} /> Encriptação de Ponta a Ponta WebRTC
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-center gap-3 pt-2 z-10">
              <button
                onClick={handleToggleMute}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition shadow-md cursor-pointer ${
                  activeCall.isMuted ? 'bg-red-500/20 text-red-400 border border-red-500' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
                title={activeCall.isMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
              >
                {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {activeCall.type === 'video' && (
                <button
                  onClick={handleToggleCamera}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition shadow-md cursor-pointer ${
                    activeCall.isCameraOff ? 'bg-amber-500/20 text-amber-400 border border-amber-500' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                  title={activeCall.isCameraOff ? 'Ligar Câmara' : 'Desligar Câmara'}
                >
                  {activeCall.isCameraOff ? <CameraOff size={20} /> : <Camera size={20} />}
                </button>
              )}

              {activeCall.type === 'audio' && (
                <button
                  onClick={handleSwitchToVideo}
                  className="w-12 h-12 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center font-bold transition shadow-md cursor-pointer"
                  title="Mudar para Chamada de Vídeo"
                >
                  <Video size={20} />
                </button>
              )}

              {activeCall.type === 'video' && (
                <button
                  onClick={handleSwitchToAudio}
                  className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center justify-center font-bold transition shadow-md cursor-pointer"
                  title="Mudar para Chamada de Áudio"
                >
                  <Phone size={20} />
                </button>
              )}

              <button
                onClick={handleEndCall}
                className="w-16 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-bold transition shadow-lg shadow-red-500/30 cursor-pointer"
                title="Desligar Chamada"
              >
                <PhoneOff size={22} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CPaaS MODAL */}
      {showCPaaSModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[5000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full p-6 text-left space-y-5 border border-cyan-500/30 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">CPaaS (Communications Platform as a Service)</h3>
                  <p className="text-xs text-slate-400 font-medium">Motor de Voz & Vídeo em Tempo Real GPA Angola</p>
                </div>
              </div>
              <button onClick={() => setShowCPaaSModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-black text-white flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" /> Estado WebRTC / PeerJS
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                    peerConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {peerConnected ? 'Conectado a Servidores STUN' : 'A Conectar...'}
                  </span>
                </div>
                <p className="font-mono text-cyan-300 text-[11px]">Peer ID: {myPeerId || 'A gerar...'}</p>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button onClick={() => setShowCPaaSModal(false)} className="px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-500 transition cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
