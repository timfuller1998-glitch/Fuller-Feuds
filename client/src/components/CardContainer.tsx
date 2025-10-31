/**
 * CardContainer - Ensures consistent card sizing across the entire site
 * Use this wrapper around TopicCard, OpinionCard, or any other card components
 * to guarantee identical dimensions everywhere
 */

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CardContainer({ children, className = "", style }: CardContainerProps) {
  return (
    <div className={`flex-none w-[280px] sm:w-[300px] ${className}`} style={style}>
      {children}
    </div>
  );
}
