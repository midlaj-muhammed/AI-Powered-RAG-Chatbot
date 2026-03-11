"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
    name: string
    url: string
    icon: LucideIcon
}

interface NavBarProps {
    items: NavItem[]
    className?: string
}

export function NavBar({ items, className }: NavBarProps) {
    const [activeTab, setActiveTab] = useState(items[0].name)

    useEffect(() => {
        const handleResize = () => {
            // Mobile detection if needed later
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    return (
        <div
            className={cn(
                "fixed bottom-0 sm:top-6 left-1/2 -translate-x-1/2 z-[200] mb-6 h-max",
                className,
            )}
        >
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 backdrop-blur-lg py-1 px-1 rounded-full shadow-2xl">
                {items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.name

                    // Handle internal anchors vs routes
                    const isAnchor = item.url.startsWith("#");

                    const handleClick = (e: React.MouseEvent) => {
                        setActiveTab(item.name);
                        if (isAnchor) {
                            e.preventDefault();
                            const element = document.getElementById(item.url.substring(1));
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth' });
                            } else if (item.url === "#") {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                        }
                    };

                    return (
                        <Link
                            key={item.name}
                            to={item.url}
                            onClick={handleClick}
                            className={cn(
                                "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors",
                                "text-white/70 hover:text-teal-400",
                                isActive && "bg-white/10 text-teal-400",
                            )}
                        >
                            <span className="hidden md:inline">{item.name}</span>
                            <span className="md:hidden">
                                <Icon size={18} strokeWidth={2.5} />
                            </span>
                            {isActive && (
                                <motion.div
                                    layoutId="lamp"
                                    className="absolute inset-0 w-full bg-teal-500/5 rounded-full -z-10"
                                    initial={false}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30,
                                    }}
                                >
                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-teal-500 rounded-t-full shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                                        <div className="absolute w-12 h-6 bg-teal-500/20 rounded-full blur-md -top-2 -left-2" />
                                        <div className="absolute w-8 h-6 bg-teal-500/20 rounded-full blur-md -top-1" />
                                        <div className="absolute w-4 h-4 bg-teal-500/20 rounded-full blur-sm top-0 left-2" />
                                    </div>
                                </motion.div>
                            )}
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
