import React from "react";

interface StatsCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
}

export function StatsCard({
  label,
  value,
  icon,
  iconBgColor = "var(--accent-blue-bg)",
  iconColor = "var(--accent-blue)",
  badge,
  footer,
  onClick
}: StatsCardProps) {
  return (
    <div
      className="stats-card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="stats-card-top">
        <div
          className="stats-icon-box"
          style={{ backgroundColor: iconBgColor, color: iconColor }}
        >
          {icon}
        </div>
        {badge}
      </div>

      <div>
        <div className="stats-label">{label}</div>
        <div className="stats-value">{value}</div>
      </div>

      {footer && <div className="stats-footer">{footer}</div>}
    </div>
  );
}
