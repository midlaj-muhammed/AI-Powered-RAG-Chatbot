import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
    scene: string;
    className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
    return (
        <Suspense
            fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-transparent z-0">
                    <div className="w-8 h-8 border-4 border-[#0CF2A0]/30 border-t-[#0CF2A0] rounded-full animate-spin" />
                </div>
            }
        >
            <Spline scene={scene} className={className} />
        </Suspense>
    );
}
