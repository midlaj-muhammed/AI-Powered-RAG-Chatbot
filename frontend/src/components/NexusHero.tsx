import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function NexusHero() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20 overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[#050505] -z-20" />
            <div className="absolute left-1/2 top-1/2 -mt-64 -ml-[400px] h-[800px] w-[800px] rounded-full bg-teal-500/10 blur-[150px] pointer-events-none mix-blend-screen" />
            <div className="absolute right-1/2 top-1/2 -mt-40 -mr-[400px] h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none mix-blend-screen" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

            {/* Hero Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 backdrop-blur-md mb-8"
                >
                    <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
                    <span className="text-xs font-medium tracking-wide text-teal-300">NexusAI Agent Framework 2.0</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                    className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-neutral-500 mb-8 drop-shadow-2xl"
                >
                    Knowledge,<br className="hidden sm:block" /> Reimagined.
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                    className="max-w-2xl text-lg sm:text-xl text-zinc-400 font-medium tracking-tight mb-12"
                >
                    Transform your enterprise data into an intelligent, highly-contextual AI assistant.
                    Powered by advanced RAG architectures and zero-latency embedding engines.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center gap-4"
                >
                    <Link to="/register" className="group relative inline-flex h-12 w-full sm:w-auto items-center justify-center overflow-hidden rounded-full bg-white px-8 font-medium text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95">
                        <span className="mr-2">Start Building for Free</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link to="/login" className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 font-medium text-white backdrop-blur-md transition-all hover:bg-white/10">
                        Sign In to Dashboard
                    </Link>
                </motion.div>

            </div>
        </section>
    );
}
