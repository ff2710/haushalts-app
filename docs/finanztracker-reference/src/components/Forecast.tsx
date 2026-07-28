import type { Forecast as ForecastData } from "../lib/types";
import { formatEuro } from "../lib/format";

interface Props {
  forecast: ForecastData;
}

// Prognose: was bleibt am Monatsende voraussichtlich übrig?
export default function Forecast({ forecast }: Props) {
  const positive = forecast.leftover >= 0;
  const empty =
    forecast.expectedIncome === 0 && forecast.fixedMonthly === 0 && forecast.variableEstimate === 0;

  return (
    <div className="card forecast-card">
      <div className="forecast-head">
        <span className="stat-label">Voraussichtlich übrig</span>
        <span className={`forecast-value ${positive ? "income" : "expense"}`}>
          {formatEuro(forecast.leftover)}
        </span>
      </div>

      {empty ? (
        <p className="muted-note">
          Lege unter „Planung" regelmäßige Einnahmen und Fixkosten an, dann rechnet
          dir die Prognose aus, was am Monatsende übrig bleibt.
        </p>
      ) : (
        <div className="forecast-breakdown">
          <div className="fb-row">
            <span>Erwartete Einnahmen</span>
            <span className="fb-plus">+{formatEuro(forecast.expectedIncome)}</span>
          </div>
          <div className="fb-row">
            <span>Fixkosten (umgerechnet)</span>
            <span className="fb-minus">−{formatEuro(forecast.fixedMonthly)}</span>
          </div>
          <div className="fb-row">
            <span>Variable Ausgaben (Schätzung)</span>
            <span className="fb-minus">−{formatEuro(forecast.variableEstimate)}</span>
          </div>
          <div className="fb-row fb-result">
            <span>Voraussichtlich übrig</span>
            <span className={positive ? "fb-plus" : "fb-minus"}>{formatEuro(forecast.leftover)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
