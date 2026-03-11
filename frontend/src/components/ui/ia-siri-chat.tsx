"use client";

import { Mic, Loader2, Volume2, Sparkles, VolumeX } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface VoiceChatProps {
    onStart?: () => void;
    onStop?: (duration: number) => void;
    onVolumeChange?: (volume: number) => void;
    className?: string;
    demoMode?: boolean;
    externalListening?: boolean;
    externalProcessing?: boolean;
    externalSpeaking?: boolean;
    externalVolume?: number;
    externalDuration?: number;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
    velocity: { x: number; y: number };
}

export function VoiceChat({
    onStart,
    onStop,
    onVolumeChange,
    className,
    demoMode = false,
    externalListening,
    externalProcessing,
    externalSpeaking,
    externalVolume,
    externalDuration
}: VoiceChatProps) {
    const [internalListening, setInternalListening] = useState(false);
    const [internalProcessing, setInternalProcessing] = useState(false);
    const [internalSpeaking, setInternalSpeaking] = useState(false);
    const [internalVolume, setInternalVolume] = useState(0);
    const [internalDuration, setInternalDuration] = useState(0);

    const isListening = externalListening ?? internalListening;
    const isProcessing = externalProcessing ?? internalProcessing;
    const isSpeaking = externalSpeaking ?? internalSpeaking;
    const volume = externalVolume ?? internalVolume;
    const duration = externalDuration ?? internalDuration;

    const [particles, setParticles] = useState<Particle[]>([]);
    const [waveformData, setWaveformData] = useState<number[]>(Array(32).fill(0));
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animationRef = useRef<number | null>(null);

    // Generate particles for ambient effect
    useEffect(() => {
        const generateParticles = () => {
            const newParticles: Particle[] = [];
            for (let i = 0; i < 20; i++) {
                newParticles.push({
                    id: i,
                    x: Math.random() * 400,
                    y: Math.random() * 400,
                    size: Math.random() * 3 + 1,
                    opacity: Math.random() * 0.3 + 0.1,
                    velocity: {
                        x: (Math.random() - 0.5) * 0.5,
                        y: (Math.random() - 0.5) * 0.5
                    }
                });
            }
            setParticles(newParticles);
        };

        generateParticles();
    }, []);

    // Animate particles
    useEffect(() => {
        const animateParticles = () => {
            setParticles(prev => prev.map(particle => ({
                ...particle,
                x: (particle.x + particle.velocity.x + 400) % 400,
                y: (particle.y + particle.velocity.y + 400) % 400,
                opacity: particle.opacity + (Math.random() - 0.5) * 0.02
            })));
            animationRef.current = requestAnimationFrame(animateParticles);
        };

        animationRef.current = requestAnimationFrame(animateParticles);
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    // Waveform simulation (only if not passed externally)
    useEffect(() => {
        if (isListening || isSpeaking) {
            intervalRef.current = setInterval(() => {
                if (externalDuration === undefined) {
                    setInternalDuration(prev => prev + 1);
                }

                // Simulate audio waveform
                const newWaveform = Array(32).fill(0).map(() =>
                    Math.random() * (isListening || isSpeaking ? 100 : 20)
                );
                setWaveformData(newWaveform);

                if (externalVolume === undefined) {
                    const newVolume = Math.random() * 100;
                    setInternalVolume(newVolume);
                    onVolumeChange?.(newVolume);
                }
            }, 100);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            setWaveformData(Array(32).fill(0));
            if (externalVolume === undefined) setInternalVolume(0);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isListening, isSpeaking, externalVolume, externalDuration, onVolumeChange]);

    // Demo mode simulation
    useEffect(() => {
        if (!demoMode) return;

        const demoSequence = async () => {
            setInternalListening(true);
            onStart?.();
            await new Promise(resolve => setTimeout(resolve, 3000));

            setInternalListening(false);
            setInternalProcessing(true);
            onStop?.(duration);
            await new Promise(resolve => setTimeout(resolve, 2000));

            setInternalProcessing(false);
            setInternalSpeaking(true);
            await new Promise(resolve => setTimeout(resolve, 4000));

            setInternalSpeaking(false);
            setInternalDuration(0);
            setTimeout(demoSequence, 2000);
        };

        const timeout = setTimeout(demoSequence, 1000);
        return () => clearTimeout(timeout);
    }, [demoMode, onStart, onStop, duration]);

    const handleToggleListening = () => {
        if (demoMode) return;

        if (isListening) {
            if (externalListening === undefined) setInternalListening(false);
            onStop?.(duration);
            if (externalDuration === undefined) setInternalDuration(0);
        } else {
            if (externalListening === undefined) setInternalListening(true);
            onStart?.();
        }
    };

    const formatTime = (seconds: number) => {
        const actualSeconds = Math.floor(seconds / 10);
        const m = Math.floor(actualSeconds / 60);
        const s = actualSeconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const getStatusText = () => {
        if (isListening) return "Listening...";
        if (isProcessing) return "Processing...";
        if (isSpeaking) return "Speaking...";
        return "Tap to speak";
    };

    const getStatusColor = () => {
        if (isListening) return "text-blue-400";
        if (isProcessing) return "text-yellow-400";
        if (isSpeaking) return "text-green-400";
        return "text-muted-foreground";
    };

    return (
        <div className={cn("flex flex-col items-center justify-center min-h-[400px] w-full bg-background/80 backdrop-blur-xl relative overflow-hidden rounded-3xl border border-white/10", className)}>
            {/* Ambient particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {particles.map(particle => (
                    <motion.div
                        key={particle.id}
                        className="absolute w-1 h-1 bg-primary/20 rounded-full"
                        style={{
                            left: particle.x,
                            top: particle.y,
                            opacity: particle.opacity
                        }}
                        animate={{
                            scale: [1, 1.5, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                ))}
            </div>

            {/* Background glow effects */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                    className="w-64 h-64 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl"
                    animate={{
                        scale: isListening ? [1, 1.2, 1] : [1, 1.1, 1],
                        opacity: isListening ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>

            <div className="relative z-10 flex flex-col items-center space-y-6">
                {/* Main voice button */}
                <motion.div
                    className="relative"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <motion.button
                        onClick={handleToggleListening}
                        className={cn(
                            "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
                            "bg-white/5 border border-white/10 backdrop-blur-md",
                            isListening ? "border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]" :
                                isProcessing ? "border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.3)]" :
                                    isSpeaking ? "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]" :
                                        "border-white/10 hover:border-white/30"
                        )}
                    >
                        <AnimatePresence mode="wait">
                            {isProcessing ? (
                                <motion.div
                                    key="processing"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                                </motion.div>
                            ) : isSpeaking ? (
                                <motion.div
                                    key="speaking"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <Volume2 className="w-10 h-10 text-green-500" />
                                </motion.div>
                            ) : isListening ? (
                                <motion.div
                                    key="listening"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <Mic className="w-10 h-10 text-blue-500" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <Mic className="w-10 h-10 text-white/40" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>

                    {/* Pulse rings */}
                    <AnimatePresence>
                        {isListening && (
                            <>
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                                    initial={{ scale: 1, opacity: 0.6 }}
                                    animate={{ scale: 1.5, opacity: 0 }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeOut"
                                    }}
                                />
                            </>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Waveform visualizer */}
                <div className="flex items-center justify-center space-x-1 h-12">
                    {waveformData.map((height, index) => (
                        <motion.div
                            key={index}
                            className={cn(
                                "w-0.5 rounded-full transition-colors duration-300",
                                isListening ? "bg-blue-500" :
                                    isProcessing ? "bg-yellow-500" :
                                        isSpeaking ? "bg-green-500" :
                                            "bg-white/10"
                            )}
                            animate={{
                                height: `${Math.max(3, height * 0.4)}px`,
                                opacity: isListening || isSpeaking ? 1 : 0.2
                            }}
                            transition={{
                                duration: 0.1,
                                ease: "easeOut"
                            }}
                        />
                    ))}
                </div>

                {/* Status and timer */}
                <div className="text-center space-y-1">
                    <motion.p
                        className={cn("text-sm font-semibold tracking-wide uppercase transition-colors", getStatusColor())}
                        animate={{ opacity: [1, 0.6, 1] }}
                        transition={{
                            duration: 2,
                            repeat: isListening || isProcessing || isSpeaking ? Infinity : 0
                        }}
                    >
                        {getStatusText()}
                    </motion.p>

                    <p className="text-xs text-white/40 font-mono">
                        {formatTime(duration)}
                    </p>

                    {volume > 0 && (
                        <motion.div
                            className="flex items-center justify-center space-x-2 pt-2"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <VolumeX className="w-3 h-3 text-white/30" />
                            <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    animate={{ width: `${volume}%` }}
                                    transition={{ duration: 0.1 }}
                                />
                            </div>
                            <Volume2 className="w-3 h-3 text-white/30" />
                        </motion.div>
                    )}
                </div>

                {/* AI indicator */}
                <motion.div
                    className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-white/30"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Voice Context</span>
                </motion.div>
            </div>
        </div>
    );
}
