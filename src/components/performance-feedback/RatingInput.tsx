import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface RatingInputProps {
  label: string;
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
  required?: boolean;
  helpText?: string;
  size?: "sm" | "md" | "lg";
}

export function RatingInput({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  helpText,
  size = "md",
}: RatingInputProps) {
  const starSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const starSize = starSizes[size];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onChange(rating)}
            className={cn(
              "transition-all duration-200",
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:scale-110 active:scale-95"
            )}
            aria-label={`Rate ${rating} out of 5`}
          >
            <Star
              className={cn(
                starSize,
                "transition-colors duration-200",
                rating <= (value || 0)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30 hover:text-amber-300"
              )}
            />
          </button>
        ))}

        {value !== null && value !== undefined && (
          <span className="text-sm font-semibold text-muted-foreground ml-2">
            {value}/5
          </span>
        )}
      </div>

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
