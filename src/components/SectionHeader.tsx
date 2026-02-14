interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    className?: string;
}

export function SectionHeader({ title, subtitle, className = "" }: SectionHeaderProps) {
    return (
        <div className={`mb-12 ${className}`}>
            <h2 className="text-3xl font-display font-medium tracking-tight text-white mb-2">
                {title}
            </h2>
            {subtitle && (
                <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
                    {subtitle}
                </p>
            )}
        </div>
    );
}
