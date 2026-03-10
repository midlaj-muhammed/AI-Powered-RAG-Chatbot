import SonicWaveformHero from '@/components/ui/sonic-waveform';
import { Link } from 'react-router-dom';
import { Bot, Github, Twitter, Linkedin, Database, Shield, Zap, Cpu, CheckCircle2, Layers, Search } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

// --- Smooth Scroll Helper ---
const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
};

// --- Animations ---
const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'circOut' as const } }
};

const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

// --- Subcomponents ---

function FeaturesSection() {
    const features = [
        {
            icon: <Database className="h-6 w-6 text-teal-400" />,
            title: "Vector Data Pipeline",
            desc: "Ingest PDFs, CSVs, and integrations. Automatically chunked and embedded via Gemini 1.5 Pro.",
            glow: "bg-teal-500/10"
        },
        {
            icon: <Zap className="h-6 w-6 text-emerald-400" />,
            title: "Zero-Latency Retrieval",
            desc: "Distributed ChromaDB vector searches guarantee sub-millisecond context gathering.",
            glow: "bg-emerald-500/10"
        },
        {
            icon: <Shield className="h-6 w-6 text-purple-400" />,
            title: "Enterprise Security",
            desc: "Role-based access control and namespace segregation. Your data never trains public models.",
            glow: "bg-purple-500/10"
        },
        {
            icon: <Cpu className="h-6 w-6 text-blue-400" />,
            title: "LangChain Orchestration",
            desc: "Complex multi-step reasoning agents that route queries dynamically based on semantic intent.",
            glow: "bg-blue-500/10"
        },
        {
            icon: <Search className="h-6 w-6 text-rose-400" />,
            title: "Hybrid Search",
            desc: "Combines dense vector similarity with sparse keyword matching for unparalleled accuracy.",
            glow: "bg-rose-500/10"
        },
        {
            icon: <Layers className="h-6 w-6 text-amber-400" />,
            title: "Infinite Memory",
            desc: "Persistent Chat History and Conversation buffers allow the AI to remember infinite context.",
            glow: "bg-amber-500/10"
        }
    ];

    return (
        <section id="features" className="relative py-32 bg-[#050505] overflow-hidden border-t border-white/5">
            <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-teal-500/20 blur-[120px] rounded-full pointer-events-none opacity-50" />

            <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeInUp}
                    className="text-center mb-20"
                >
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-6">
                        <span className="text-xs font-semibold tracking-wider text-white/70 uppercase">Platform Features</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
                        Everything you need for <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">production AI.</span>
                    </h2>
                    <p className="max-w-2xl mx-auto text-lg text-white/50">
                        NexusAI provides a complete toolchain. From raw document ingestion to
                        user-facing chatbot interfaces, all powered by leading foundational models.
                    </p>
                </motion.div>

                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={staggerContainer}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            variants={fadeInUp}
                            className="group relative rounded-3xl border border-white/10 bg-[#0A0A0A] p-8 overflow-hidden transition-all hover:bg-[#111] hover:border-white/20"
                        >
                            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[50px] transition-opacity opacity-20 group-hover:opacity-60 ${f.glow}`} />
                            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                                {f.icon}
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">{f.title}</h3>
                            <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

function ArchitectureSection() {
    return (
        <section id="architecture" className="py-32 bg-[#050505] relative border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        variants={staggerContainer}
                    >
                        <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 mb-6">
                            <span className="text-xs font-semibold tracking-wider text-purple-300 uppercase">Architecture</span>
                        </motion.div>
                        <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
                            Built on a highly scalable RAG foundation.
                        </motion.h2>
                        <motion.p variants={fadeInUp} className="text-lg text-white/50 mb-8 leading-relaxed">
                            NexusAI bypasses the limitations of fine-tuning. By injecting exactly the right
                            context into the prompt at runtime, the AI avoids hallucinations and guarantees
                            up-to-date answers based strictly on your source of truth.
                        </motion.p>

                        <motion.div variants={staggerContainer} className="space-y-6">
                            {[
                                "1. Documents are parsed and split into semantic chunks.",
                                "2. Chunks are embedded into 3072-dimensional vectors.",
                                "3. Vectors are indexed in a high-speed ChromaDB collection.",
                                "4. User queries are embedded and compared via Cosine Similarity."
                            ].map((step, i) => (
                                <motion.div key={i} variants={fadeInUp} className="flex items-start gap-4">
                                    <div className="flex bg-white/5 border border-white/10 rounded-full p-1 mt-1">
                                        <CheckCircle2 className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <p className="text-white/70 font-medium">{step}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>

                    {/* Visual abstract representation of architecture */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        viewport={{ once: true }}
                        className="relative h-[500px] w-full rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent overflow-hidden flex items-center justify-center p-8"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />

                        {/* Abstract UI representation */}
                        <div className="relative w-full max-w-sm flex flex-col gap-4">
                            <div className="w-full rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-6 shadow-2xl animate-[float_6s_ease-in-out_infinite]">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500" />
                                    <div className="h-3 w-24 rounded-full bg-white/20" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-2 w-full rounded-full bg-white/10" />
                                    <div className="h-2 w-4/5 rounded-full bg-white/10" />
                                </div>
                            </div>

                            <div className="w-full rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-6 shadow-2xl animate-[float_6s_ease-in-out_infinite_1s] ml-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <Database className="h-6 w-6 text-teal-400" />
                                    <div className="h-3 w-32 rounded-full bg-white/20" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-8 w-8 rounded-md bg-teal-500/20 border border-teal-500/30" />
                                    <div className="h-8 w-8 rounded-md bg-teal-500/20 border border-teal-500/30" />
                                    <div className="h-8 w-8 rounded-md bg-white/5 border border-white/10" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

function PricingSection() {
    return (
        <section id="pricing" className="py-32 bg-[#050505] relative border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeInUp}
                    className="text-center mb-20"
                >
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
                        Simple, transparent pricing.
                    </h2>
                    <p className="max-w-2xl mx-auto text-lg text-white/50">
                        Start building for free. Upgrade when you need enterprise scale.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Free Tier */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-10"
                    >
                        <h3 className="text-2xl font-bold text-white mb-2">Developer</h3>
                        <p className="text-white/50 mb-6">Perfect for exploring the platform.</p>
                        <div className="flex items-baseline gap-2 mb-8">
                            <span className="text-5xl font-bold text-white">$0</span>
                            <span className="text-white/50">/ month</span>
                        </div>

                        <Link to="/register" className="flex w-full h-12 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white font-semibold transition hover:bg-white/20 mb-8">
                            Get Started
                        </Link>

                        <ul className="space-y-4">
                            {[
                                "1 Project",
                                "100 Documents",
                                "Gemini Flash 8B Model",
                                "Community Support"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-white/70">
                                    <CheckCircle2 className="h-5 w-5 text-teal-500" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Pro Tier */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="rounded-3xl border border-teal-500/30 bg-gradient-to-b from-teal-500/10 to-[#0A0A0A] p-10 relative overflow-hidden"
                    >
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 to-emerald-400" />
                        <div className="absolute right-8 top-8 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300">Popular</div>

                        <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                        <p className="text-teal-200/50 mb-6">For production workloads.</p>
                        <div className="flex items-baseline gap-2 mb-8">
                            <span className="text-5xl font-bold text-white">$99</span>
                            <span className="text-white/50">/ month</span>
                        </div>

                        <Link to="/register" className="flex w-full h-12 items-center justify-center rounded-xl bg-teal-500 text-black font-bold transition hover:bg-teal-400 mb-8 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                            Upgrade to Enterprise
                        </Link>

                        <ul className="space-y-4">
                            {[
                                "Unlimited Projects",
                                "Infinite Documents",
                                "Groq Llama 3 70B Model",
                                "Priority 24/7 Support",
                                "Custom Roles & Namespaces"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-white/90">
                                    <CheckCircle2 className="h-5 w-5 text-teal-400" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// --- Main Page ---
export function LandingPage() {
    return (
        <main className="min-h-screen bg-[#050505] selection:bg-teal-500/30">

            {/* GLASSSMORPHIC NAVBAR */}
            <nav className="fixed top-0 inset-x-0 z-50 h-20 border-b border-white/5 bg-[#050505]/60 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/40 transition-all">
                <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6 lg:px-12">

                    {/* Logo */}
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="group flex items-center gap-3 cursor-pointer">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 shadow-[0_0_20px_rgba(20,184,166,0.2)] border border-teal-500/30 transition-transform group-hover:scale-105">
                            <Bot className="h-5 w-5 text-teal-400" />
                        </div>
                        <span className="font-bold tracking-tight text-white text-xl">NexusAI</span>
                    </button>

                    {/* Links */}
                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-white/50 hover:text-white transition-colors cursor-pointer">Platform</button>
                        <button onClick={() => scrollToSection('architecture')} className="text-sm font-medium text-white/50 hover:text-white transition-colors cursor-pointer">Architecture</button>
                        <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-white/50 hover:text-white transition-colors cursor-pointer">Pricing</button>
                    </div>

                    {/* Auth CTA */}
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white transition">
                            Sign In
                        </Link>
                        <Link
                            to="/register"
                            className="group relative flex h-10 items-center justify-center overflow-hidden rounded-full bg-white px-6 text-sm font-medium text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                            Get Started
                        </Link>
                    </div>

                </div>
            </nav>

            {/* SONIC WAVEFORM HERO */}
            <SonicWaveformHero />

            {/* NEW SECTIONS */}
            <FeaturesSection />
            <ArchitectureSection />
            <PricingSection />

            {/* MINIMALIST FOOTER */}
            <footer className="relative border-t border-white/5 bg-[#050505] pt-24 pb-12 overflow-hidden">
                {/* Subtle grid in footer */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />

                <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8 mb-16">
                        <div className="col-span-1 md:col-span-2">
                            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 mb-6 cursor-pointer">
                                <Bot className="h-8 w-8 text-teal-500" />
                                <span className="font-bold tracking-tight text-white text-2xl">NexusAI</span>
                            </button>
                            <p className="max-w-xs text-white/40 text-sm leading-relaxed">
                                The enterprise retrieval-augmented generation platform. Deploy highly-contextual AI systems over your data in seconds.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white font-medium mb-4">Product</h4>
                            <ul className="space-y-3">
                                <li><button onClick={() => scrollToSection('features')} className="text-sm text-white/40 hover:text-teal-400 transition cursor-pointer">Vector DB Engine</button></li>
                                <li><button onClick={() => scrollToSection('architecture')} className="text-sm text-white/40 hover:text-teal-400 transition cursor-pointer">Agent Workflows</button></li>
                                <li><button onClick={() => scrollToSection('pricing')} className="text-sm text-white/40 hover:text-teal-400 transition cursor-pointer">Pricing</button></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-medium mb-4">Connect</h4>
                            <div className="flex items-center gap-4">
                                <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition text-white/60 hover:text-teal-400">
                                    <Twitter className="h-4 w-4" />
                                </a>
                                <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition text-white/60 hover:text-teal-400">
                                    <Github className="h-4 w-4" />
                                </a>
                                <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition text-white/60 hover:text-teal-400">
                                    <Linkedin className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between border-t border-white/10 pt-8 text-xs text-white/30">
                        <p>© {new Date().getFullYear()} NexusAI, Inc. All rights reserved.</p>
                        <div className="flex gap-4 mt-4 md:mt-0">
                            <a href="#" className="hover:text-white transition">Privacy Policy</a>
                            <a href="#" className="hover:text-white transition">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
