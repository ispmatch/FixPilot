export default function Logo({ compact = false, className = "" }) {
  const iconUrl = "https://media.base44.com/images/public/6a42567182c58083937d0c43/7b98fd004_FixPilotIcon.png";
  const bannerUrl = "https://media.base44.com/images/public/6a42567182c58083937d0c43/7c4614978_FixPilotMainbrandingbanner.png";

  if (compact) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div className="relative w-8 h-8 shrink-0">
          <img
            src={iconUrl}
            alt="FixPilot"
            className="w-full h-full object-cover rounded"
          />
        </div>
        <div className="leading-tight">
          <span className="font-bold text-foreground text-sm tracking-tight">
            Fix<span className="text-primary">Pilot</span>
          </span>
          <p className="text-[10px] text-muted-foreground">.cloud</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={bannerUrl}
      alt="FixPilot.cloud — AI Copilot for WordPress & WooCommerce"
      className={className}
    />
  );
}