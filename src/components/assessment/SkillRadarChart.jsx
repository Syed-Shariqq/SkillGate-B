import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function SkillRadarChart({ data, chartColors }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart
        cx="50%"
        cy="50%"
        outerRadius="70%"
        data={data}
      >
        <PolarGrid stroke={chartColors.grid} />
        <PolarAngleAxis
          dataKey="skill"
          tick={{
            fill: chartColors.text,
            fontSize: 11,
            fontWeight: 500,
          }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke={chartColors.stroke}
          fill={chartColors.fill}
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-secondary, #1c1c1f)",
            borderColor: "var(--color-border-default, #2d2d30)",
            color: "var(--color-text-primary, #ffffff)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
