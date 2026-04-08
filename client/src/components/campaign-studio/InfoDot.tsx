import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InfoDotProps {
  title: string;
  body: string;
}

export function InfoDot({ title, body }: InfoDotProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cs-infodot cs-focusRing"
          aria-label={`More info: ${title}`}
        >
          <Info className="cs-infodot-icon" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="cs-infodot-content" 
        side="top" 
        sideOffset={8}
        align="center"
      >
        <h4 className="cs-infodot-title">{title}</h4>
        <p className="cs-infodot-body">{body}</p>
      </PopoverContent>
    </Popover>
  );
}
