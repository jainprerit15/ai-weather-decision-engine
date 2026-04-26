"use client";

import { FormEvent, useMemo, useState } from "react";

type WeatherBundle = {
  city: string;
  current: {
    temp: number;
    humidity: number;
    wind: number;
    main: string;
    description: string;
    rain1h: number;
  };
  forecast: {
    dt: string;
    temp: number;
    humidity: number;
    wind: number;
    rain3h: number;
  }[];
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

async function readApiError(response: Response, label: string) {
  let detail = "";
  try {
    const data = await response.json();
    detail = data?.message ? `: ${data.message}` : "";
  } catch {
    detail = "";
  }
  return `${label} failed (${response.status}${detail})`;
}

function parseBundle(current: any, forecast: any): WeatherBundle {
  return {
    city: current.name,
    current: {
      temp: current.main.temp,
      humidity: current.main.humidity,
      wind: current.wind.speed,
      main: current.weather[0].main,
      description: current.weather[0].description,
      rain1h: current.rain?.["1h"] ?? 0
    },
    forecast: forecast.list.slice(0, 16).map((f: any) => ({
      dt: f.dt_txt,
      temp: f.main.temp,
      humidity: f.main.humidity,
      wind: f.wind.speed,
      rain3h: f.rain?.["3h"] ?? 0
    }))
  };
}

function umbrellaScore(w: WeatherBundle) {
  const rain = w.current.rain1h + w.forecast.slice(0, 6).reduce((s, x) => s + x.rain3h, 0);
  return clamp(Math.round(rain * 18 + (/rain|storm|drizzle/i.test(w.current.main) ? 35 : 0)));
}

function bestWorkoutWindow(w: WeatherBundle) {
  let best = { slot: "N/A", score: 0 };
  for (let i = 0; i < w.forecast.length - 1; i += 1) {
    const a = w.forecast[i];
    const b = w.forecast[i + 1];
    const t = (a.temp + b.temp) / 2;
    const h = (a.humidity + b.humidity) / 2;
    const rain = a.rain3h + b.rain3h;
    const score = clamp(Math.round(100 - Math.abs(t - 24) * 4 - Math.max(h - 60, 0) * 0.6 - rain * 14));
    if (score > best.score) {
      best = { slot: `${new Date(a.dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(b.dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, score };
    }
  }
  return best;
}

function clothing(w: WeatherBundle) {
  const hot = w.current.temp >= 32;
  const cool = w.current.temp <= 18;
  const rainy = /rain|storm|drizzle/i.test(w.current.main) || w.current.rain1h > 0;
  return {
    top: hot ? "Breathable t-shirt" : cool ? "Full-sleeve tee" : "Light t-shirt",
    bottom: hot ? "Light chinos/shorts" : "Jeans/track pants",
    layer: rainy ? "Waterproof shell" : cool ? "Light jacket" : w.current.wind > 8 ? "Windcheater" : "No extra layer",
    accessory: rainy ? "Umbrella + water-resistant shoes" : "Sunglasses"
  };
}

function risks(w: WeatherBundle) {
  const rain = w.current.rain1h + w.forecast.slice(0, 6).reduce((s, x) => s + x.rain3h, 0);
  return {
    bike: clamp(Math.round(rain * 18 + w.current.wind * 6)),
    running: clamp(Math.round(100 - Math.max(0, w.current.temp - 28) * 3 - Math.max(0, w.current.humidity - 65) * 0.7 - rain * 10)),
    heat: clamp(Math.round(Math.max(0, w.current.temp - 30) * 8 + Math.max(0, w.current.humidity - 70) * 0.8))
  };
}

function comfort(city: string, w: WeatherBundle) {
  const rainRisk = clamp(Math.round((w.current.rain1h + w.forecast.slice(0, 6).reduce((s, x) => s + x.rain3h, 0)) * 14));
  const heatRisk = clamp(Math.round(Math.max(0, w.current.temp - 30) * 8));
  const outdoor = clamp(Math.round(100 - Math.abs(w.current.temp - 24) * 3 - Math.max(0, w.current.humidity - 65) * 0.5));
  const comfortIndex = clamp(Math.round(outdoor * 0.6 + (100 - rainRisk) * 0.2 + (100 - heatRisk) * 0.2));
  return { city, comfortIndex, rainRisk, heatRisk, outdoor };
}

export default function Home() {
  const [city, setCity] = useState("Jaipur");
  const [cities, setCities] = useState("Jaipur, Pune, Bengaluru");
  const [question, setQuestion] = useState("Will tomorrow evening be good for cricket in Jaipur?");
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [compareData, setCompareData] = useState<Array<{ city: string; comfortIndex: number; rainRisk: number; heatRisk: number; outdoor: number }>>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const quick = useMemo(() => (weather ? `${weather.city}: ${weather.current.temp.toFixed(1)}C, ${weather.current.description}` : ""), [weather]);

  async function fetchWeather(target: string) {
    const key = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!key) throw new Error("Add NEXT_PUBLIC_OPENWEATHER_API_KEY to .env.local");

    const c = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(target)}&appid=${key}&units=metric`);
    if (!c.ok) {
      throw new Error(await readApiError(c, `Current weather for ${target}`));
    }

    const f = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(target)}&appid=${key}&units=metric`);
    if (!f.ok) {
      throw new Error(await readApiError(f, `Forecast for ${target}`));
    }

    return parseBundle(await c.json(), await f.json());
  }

  async function analyze(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setWeather(await fetchWeather(city));
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  async function askAi() {
    if (!weather) return setAnswer("Analyze city first.");

    setLoading(true);
    setAnswer("Generating AI response...");
    try {
      const res = await fetch("/api/ask-weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, weather })
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload?.error || `AI request failed (${res.status})`);
      }

      const data = await res.json();
      setAnswer(data.answer ?? "No answer generated.");
    } catch (err) {
      setAnswer(err instanceof Error ? err.message : "AI request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function compareCities() {
    setLoading(true);
    setError("");
    try {
      const list = cities.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5);
      const bundles = await Promise.all(list.map((x) => fetchWeather(x)));
      setCompareData(bundles.map((b) => comfort(b.city, b)).sort((a, b) => b.comfortIndex - a.comfortIndex));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
      setCompareData([]);
    } finally {
      setLoading(false);
    }
  }

  const u = weather ? umbrellaScore(weather) : 0;
  const w = weather ? bestWorkoutWindow(weather) : { slot: "-", score: 0 };
  const c = weather ? clothing(weather) : null;
  const r = weather ? risks(weather) : null;

  return (
    <main className="container">
      <h1>AI Weather Decision Engine</h1>
      <p className="subtitle">Action-oriented weather intelligence for daily planning, travel, fitness, and city comparisons.</p>

      <form onSubmit={analyze} className="panel row">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city e.g. Jaipur" />
        <button type="submit" disabled={loading}>{loading ? "Loading..." : "Analyze City"}</button>
      </form>
      {quick ? <p className="quick">{quick}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <article className="card"><h3>Best 2-hour Outdoor Workout Window</h3><p>{w.slot}</p><p>Suitability score: {w.score}/100</p></article>
        <article className="card"><h3>Umbrella Decision</h3><p>Confidence: {u}%</p><p>{u >= 60 ? "Carry umbrella." : u >= 30 ? "Keep compact umbrella." : "Umbrella likely not needed."}</p></article>
        <article className="card"><h3>Smart Clothing Recommendation</h3>{c ? <ul><li>{c.top}</li><li>{c.bottom}</li><li>{c.layer}</li><li>{c.accessory}</li></ul> : <p>Analyze city first.</p>}</article>
        <article className="card"><h3>Travel / Weather Risk Assistant</h3>{r ? <ul><li>Bike commute risk: {r.bike}/100</li><li>Running quality score: {r.running}/100</li><li>Heat alert: {r.heat}/100</li></ul> : <p>Analyze city first.</p>}</article>
      </section>

      <section className="panel">
        <h2>Natural-language Weather Q&A</h2>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
        <button type="button" onClick={askAi} disabled={loading}>Ask AI</button>
        {answer ? <pre>{answer}</pre> : null}
      </section>

      <section className="panel">
        <h2>AI City Comparison (Trip Comfort Index)</h2>
        <input value={cities} onChange={(e) => setCities(e.target.value)} placeholder="Jaipur, Pune, Bengaluru" />
        <button type="button" onClick={compareCities} disabled={loading}>Compare Cities</button>
        {compareData.length > 0 ? (
          <div className="table">
            <div className="thead"><span>City</span><span>Comfort</span><span>Rain Risk</span><span>Heat Risk</span><span>Outdoor</span></div>
            {compareData.map((item) => (
              <div className="trow" key={item.city}>
                <span>{item.city}</span><span>{item.comfortIndex}</span><span>{item.rainRisk}</span><span>{item.heatRisk}</span><span>{item.outdoor}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Run comparison after adding 2-5 cities.</p>
        )}
      </section>
    </main>
  );
}
