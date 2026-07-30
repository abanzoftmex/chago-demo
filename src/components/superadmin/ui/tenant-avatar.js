import { cn } from "../lib/utils";
import { getTenantInitials } from "../lib/format";

const sizes = {
  sm: "size-9 rounded-xl text-xs",
  md: "size-11 rounded-2xl text-sm",
  lg: "size-16 rounded-3xl text-lg",
};

/** Avatar con iniciales del tenant sobre tinta con acento cobre. */
function TenantAvatar({ name, size = "md", className }) {
  return (
    <div
      className={cn(
        "flex shrink-0 select-none items-center justify-center bg-[linear-gradient(140deg,#2b241c_0%,#17130f_60%)] font-semibold tracking-wide text-[#e8ddcd] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_-10px_rgba(27,23,18,0.5)] ring-1 ring-black/5",
        sizes[size],
        className
      )}
    >
      {getTenantInitials(name)}
    </div>
  );
}

export { TenantAvatar };
