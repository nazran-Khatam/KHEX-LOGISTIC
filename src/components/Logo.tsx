import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  light?: boolean;
}

export default function Logo({ className, light = false }: LogoProps) {
  const textColor = light ? 'text-white' : 'text-black';
  
  return (
    <div className={cn("flex flex-col items-center w-full max-w-[160px]", className)}>
      <div className="flex items-baseline leading-none mb-1">
        <span className={cn("text-4xl font-black tracking-[0.05em]", textColor)}>KH</span>
        <span className="text-4xl font-black tracking-[0.05em] text-[#FF9800]">EX</span>
      </div>
      <div className="flex items-center gap-2 w-full">
        <div className={cn("h-[1px] flex-1", light ? "bg-white" : "bg-black")} />
        <span className={cn("text-[8px] font-bold uppercase tracking-[0.4em]", light ? "text-white" : "text-black")}>
          Logistic
        </span>
        <div className={cn("h-[1px] flex-1", light ? "bg-white" : "bg-black")} />
      </div>
    </div>
  );
}
