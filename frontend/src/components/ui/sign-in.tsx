import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// --- TYPE DEFINITIONS ---

export interface Testimonial {
    avatarSrc: string;
    name: string;
    handle: string;
    text: string;
}

interface SignInPageProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
    heroImageSrc?: string;
    testimonials?: Testimonial[];
    errorMessage?: string;
    loading?: boolean;
    onSignIn?: (email: string, password: string, rememberMe: boolean) => void;
    onCreateAccount?: () => void;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
        {children}
    </div>
);

const TestimonialCard = ({
    testimonial,
    delay,
}: {
    testimonial: Testimonial;
    delay: string;
}) => (
    <div
        className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64`}
    >
        <img
            src={testimonial.avatarSrc}
            className="h-10 w-10 object-cover rounded-2xl flex-shrink-0"
            alt={testimonial.name}
        />
        <div className="text-sm leading-snug">
            <p className="flex items-center gap-1 font-medium text-foreground">
                {testimonial.name}
            </p>
            <p className="text-muted-foreground">{testimonial.handle}</p>
            <p className="mt-1 text-foreground/80">{testimonial.text}</p>
        </div>
    </div>
);

// --- MAIN SIGN-IN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
    title = (
        <span className="font-light text-foreground tracking-tighter">
            Welcome back
        </span>
    ),
    description = 'Sign in to your account and continue your journey with us',
    heroImageSrc,
    testimonials = [],
    errorMessage,
    loading = false,
    onSignIn,
    onCreateAccount,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSignIn?.(email, password, rememberMe);
    };

    return (
        <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
            {/* Left column: sign-in form */}
            <section className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
                            {title}
                        </h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground">
                            {description}
                        </p>

                        {errorMessage && (
                            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                                {errorMessage}
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="animate-element animate-delay-300">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Email Address
                                </label>
                                <GlassInputWrapper>
                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                    />
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-400">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Password
                                </label>
                                <GlassInputWrapper>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            ) : (
                                                <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            )}
                                        </button>
                                    </div>
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="rememberMe"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-border accent-violet-500 cursor-pointer"
                                    />
                                    <span className="text-foreground/90">Keep me signed in</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && (
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8v8z"
                                        />
                                    </svg>
                                )}
                                {loading ? 'Signing in…' : 'Sign In'}
                            </button>
                        </form>

                        <p className="animate-element animate-delay-700 text-center text-sm text-muted-foreground">
                            New to our platform?{' '}
                            <button
                                type="button"
                                onClick={onCreateAccount}
                                className="text-violet-400 hover:underline transition-colors cursor-pointer"
                            >
                                Create Account
                            </button>
                        </p>
                    </div>
                </div>
            </section>

            {/* Right column: hero image + testimonials */}
            {heroImageSrc && (
                <section className="hidden md:block flex-1 relative p-4">
                    <div
                        className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
                        style={{ backgroundImage: `url(${heroImageSrc})` }}
                    />
                    {testimonials.length > 0 && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
                            <TestimonialCard
                                testimonial={testimonials[0]}
                                delay="animate-delay-1000"
                            />
                            {testimonials[1] && (
                                <div className="hidden xl:flex">
                                    <TestimonialCard
                                        testimonial={testimonials[1]}
                                        delay="animate-delay-1200"
                                    />
                                </div>
                            )}
                            {testimonials[2] && (
                                <div className="hidden 2xl:flex">
                                    <TestimonialCard
                                        testimonial={testimonials[2]}
                                        delay="animate-delay-1400"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};


// --- TYPE DEFINITIONS for SignUp ---

interface SignUpPageProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
    heroImageSrc?: string;
    testimonials?: Testimonial[];
    errorMessage?: string;
    fieldErrors?: Record<string, string>;
    loading?: boolean;
    onSignUp?: (payload: {
        first_name: string;
        last_name: string;
        email: string;
        password: string;
        password_confirm: string;
    }) => void;
    onSignIn?: () => void;
}

// --- MAIN SIGN-UP COMPONENT ---

export const SignUpPage: React.FC<SignUpPageProps> = ({
    title = (
        <span className="font-light text-foreground tracking-tighter">
            Get started
        </span>
    ),
    description = 'Create your account and unlock the power of your private AI',
    heroImageSrc,
    testimonials = [],
    errorMessage,
    fieldErrors = {},
    loading = false,
    onSignUp,
    onSignIn,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        password_confirm: '',
    });

    const update = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSignUp?.(form);
    };

    const FieldError = ({ field }: { field: string }) =>
        fieldErrors[field] ? (
            <p className="text-xs text-destructive mt-1 pl-1">{fieldErrors[field]}</p>
        ) : null;

    return (
        <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
            {/* Left column: sign-up form */}
            <section className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
                <div className="w-full max-w-md py-8">
                    <div className="flex flex-col gap-6">
                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
                            {title}
                        </h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground">
                            {description}
                        </p>

                        {errorMessage && (
                            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                                {errorMessage}
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="animate-element animate-delay-300 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                        First Name
                                    </label>
                                    <GlassInputWrapper>
                                        <input
                                            name="first_name"
                                            type="text"
                                            placeholder="John"
                                            value={form.first_name}
                                            onChange={(e) => update('first_name', e.target.value)}
                                            required
                                            autoFocus
                                            className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                        />
                                    </GlassInputWrapper>
                                    <FieldError field="first_name" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                        Last Name
                                    </label>
                                    <GlassInputWrapper>
                                        <input
                                            name="last_name"
                                            type="text"
                                            placeholder="Doe"
                                            value={form.last_name}
                                            onChange={(e) => update('last_name', e.target.value)}
                                            required
                                            className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                        />
                                    </GlassInputWrapper>
                                    <FieldError field="last_name" />
                                </div>
                            </div>

                            <div className="animate-element animate-delay-400">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Email Address
                                </label>
                                <GlassInputWrapper>
                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={form.email}
                                        onChange={(e) => update('email', e.target.value)}
                                        required
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                    />
                                </GlassInputWrapper>
                                <FieldError field="email" />
                            </div>

                            <div className="animate-element animate-delay-500">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Password
                                </label>
                                <GlassInputWrapper>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Min. 8 characters"
                                            value={form.password}
                                            onChange={(e) => update('password', e.target.value)}
                                            required
                                            minLength={8}
                                            className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            ) : (
                                                <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                                            )}
                                        </button>
                                    </div>
                                </GlassInputWrapper>
                                <FieldError field="password" />
                            </div>

                            <div className="animate-element animate-delay-600">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Confirm Password
                                </label>
                                <GlassInputWrapper>
                                    <input
                                        name="password_confirm"
                                        type="password"
                                        placeholder="Repeat your password"
                                        value={form.password_confirm}
                                        onChange={(e) => update('password_confirm', e.target.value)}
                                        required
                                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground"
                                    />
                                </GlassInputWrapper>
                                <FieldError field="password_confirm" />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="animate-element animate-delay-700 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && (
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8v8z"
                                        />
                                    </svg>
                                )}
                                {loading ? 'Creating account…' : 'Create Account'}
                            </button>
                        </form>

                        <p className="animate-element animate-delay-800 text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={onSignIn}
                                className="text-violet-400 hover:underline transition-colors cursor-pointer"
                            >
                                Sign In
                            </button>
                        </p>
                    </div>
                </div>
            </section>

            {/* Right column: hero image + testimonials */}
            {heroImageSrc && (
                <section className="hidden md:block flex-1 relative p-4">
                    <div
                        className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
                        style={{ backgroundImage: `url(${heroImageSrc})` }}
                    />
                    {testimonials.length > 0 && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
                            <TestimonialCard
                                testimonial={testimonials[0]}
                                delay="animate-delay-1000"
                            />
                            {testimonials[1] && (
                                <div className="hidden xl:flex">
                                    <TestimonialCard
                                        testimonial={testimonials[1]}
                                        delay="animate-delay-1200"
                                    />
                                </div>
                            )}
                            {testimonials[2] && (
                                <div className="hidden 2xl:flex">
                                    <TestimonialCard
                                        testimonial={testimonials[2]}
                                        delay="animate-delay-1400"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};
