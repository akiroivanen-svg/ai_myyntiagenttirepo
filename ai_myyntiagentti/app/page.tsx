"use client";

import { FormEvent, useMemo, useState } from "react";

type Lead = {
  name: string;
  initials: string;
  businessId: string;
  industry: string;
  location: string;
  employees: number | null;
  revenue: number | null;
  fit: "Vahva" | "Mahdollinen" | null;
  reason: string;
  signal: string;
  color: string;
  website: string | null;
  financialReportsAvailable: boolean;
  sources: { label: string; url: string }[];
};

const researchedLeads: Lead[] = [
  {
    name: "VEO Oy",
    initials: "VE",
    businessId: "1571996-6",
    industry: "Energia-automaatio",
    location: "Vaasa",
    employees: 445,
    revenue: 103_907_000,
    fit: "Vahva",
    reason: "Asiakasportaali ja digitaalinen kaksonen ovat käytössä. Varaosatilaus ja palvelun laajentaminen ovat yhtiön mukaan seuraavia kehityskohteita.",
    signal: "Portaalin jatkokehitys",
    color: "mint",
    website: "https://veo.fi/",
    financialReportsAvailable: false,
    sources: [
      { label: "Asiakasportaali", url: "https://veo.fi/news/veos-lifecycle-support-gains-momentum-with-new-customer-portal/" },
      { label: "VEOCyber", url: "https://veo.fi/news/veo-launches-veocyber-vulnerability-monitoring-for-critical-systems/" },
      { label: "Talousluvut", url: "https://www.asiakastieto.fi/yritykset/fi/veo-oy/15719966/taloustiedot" },
    ],
  },
  {
    name: "Pemamek Oy",
    initials: "PE",
    businessId: "0535085-1",
    industry: "Hitsausautomaatio",
    location: "Loimaa",
    employees: 386,
    revenue: 155_232_000,
    fit: "Mahdollinen",
    reason: "PEMA Core -ohjelmistoperhettä kehitetään aktiivisesti. Mach Machines -yritysosto laajensi toimintaa Pohjois-Amerikassa; ohjelmistot tehdään kuitenkin omalla tiimillä.",
    signal: "Ohjelmistokehitys + yritysosto",
    color: "yellow",
    website: "https://pemamek.com/fi/",
    financialReportsAvailable: false,
    sources: [
      { label: "PEMA Core", url: "https://pemamek.com/fi/pema-core/" },
      { label: "Yritysosto", url: "https://pemamek.com/fi/uutiset/pemamek-vahvistaa-asemaansa-pohjois-amerikassa-ostamalla-mach-machinesin-liiketoiminnan/" },
      { label: "Talousluvut", url: "https://www.asiakastieto.fi/yritykset/fi/pemamek-oy/05350851/taloustiedot" },
    ],
  },
  {
    name: "Fastems Oy Ab",
    initials: "FA",
    businessId: "1507705-1",
    industry: "Teollisuusautomaatio",
    location: "Tampere",
    employees: 267,
    revenue: 60_610_000,
    fit: "Mahdollinen",
    reason: "MMS-ohjelmisto yhdistää tuotannon ERP-, CAM- ja TDM-järjestelmiin sekä koneisiin. Ulkoisesta kehityshankinnasta ei löytynyt julkista ilmoitusta.",
    signal: "Ohjelmistointegraatiot",
    color: "blue",
    website: "https://www.fastems.com/",
    financialReportsAvailable: false,
    sources: [
      { label: "MMS-ohjelmisto", url: "https://www.fastems.com/offering/mms/" },
      { label: "Talousluvut", url: "https://www.asiakastieto.fi/yritykset/fi/fastems-oy-ab/15077051/taloustiedot" },
    ],
  },
];

type View = "all" | "strong" | "saved";

export default function Home() {
  const [query, setQuery] = useState("automaatiotekniikka");
  const [location, setLocation] = useState("");
  const [minimumRevenue, setMinimumRevenue] = useState("1");
  const [minimumEmployees, setMinimumEmployees] = useState("20");
  const [leads, setLeads] = useState(researchedLeads);
  const [view, setView] = useState<View>("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [lastSearch, setLastSearch] = useState("Aiemmin tutkittu lista · liikevaihto yli 1 M€ · yli 20 työntekijää");
  const [searchCount, setSearchCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiSource, setApiSource] = useState("Tutkittu lähdelista");

  const matchingLeads = useMemo(() => leads.filter((lead) => {
    const revenueMatches = lead.revenue === null || lead.revenue > Number(minimumRevenue || 0) * 1_000_000;
    const employeesMatch = lead.employees === null || lead.employees > Number(minimumEmployees || 0);
    return revenueMatches && employeesMatch;
  }), [leads, minimumEmployees, minimumRevenue]);

  const visibleLeads = useMemo(() => {
    if (view === "saved") return matchingLeads.filter((lead) => saved.includes(lead.name));
    if (view === "strong") return matchingLeads.filter((lead) => lead.fit === "Vahva");
    return matchingLeads;
  }, [matchingLeads, saved, view]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() && !location.trim()) {
      setApiError("Anna toimiala tai paikkakunta, jotta PRH-haku voidaan tehdä.");
      return;
    }

    setIsLoading(true);
    setApiError("");
    const parameters = new URLSearchParams();
    if (query.trim()) parameters.set("industry", query.trim());
    if (location.trim()) parameters.set("location", location.trim());

    try {
      const response = await fetch(`/api/leads?${parameters.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Haku epäonnistui.");

      const apiLeads = (result.leads as Omit<Lead, "initials" | "color" | "fit">[]).map((lead, index): Lead => ({
        ...lead,
        initials: lead.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
        color: ["mint", "yellow", "blue", "coral"][index % 4],
        fit: lead.revenue !== null && lead.employees !== null ? "Mahdollinen" : null,
      }));

      setLeads(apiLeads);
      setApiSource("PRH YTJ + XBRL API");
      setLastSearch(`${query.trim() || "Kaikki toimialat"} · ${location.trim() || "Koko Suomi"} · yli ${minimumRevenue || 0} M€ · yli ${minimumEmployees || 0} hlö`);
      setSearchCount((count) => count + 1);
      setView("all");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Haku epäonnistui.");
    } finally {
      setIsLoading(false);
    }
  }

  function restoreResearchList() {
    setLeads(researchedLeads);
    setApiSource("Tutkittu lähdelista");
    setLastSearch("Aiemmin tutkittu lista · liikevaihto yli 1 M€ · yli 20 työntekijää");
    setView("all");
    setApiError("");
  }

  function toggleSaved(name: string) {
    setSaved((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#etusivu" aria-label="Polku, etusivu">
          <span className="brand-mark">p</span>
          <span>polku<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">AM</span>
          <span className="workspace-copy"><strong>Oma työtila</strong><small>Myyntitiimi</small></span>
          <span className="switcher-chevron">⌄</span>
        </div>

        <p className="nav-label">TYÖPÖYTÄ</p>
        <nav className="main-nav" aria-label="Päänavigaatio">
          <a className="nav-item active" href="#liidit"><span className="nav-icon">⌕</span>Liidien haku</a>
          <button className="nav-item" onClick={() => setView("saved")}><span className="nav-icon">☆</span>Tallennetut <span className="nav-count">{saved.length}</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="usage-box">
            <div className="usage-top"><span>Kuukauden haut</span><strong>{searchCount} / 20</strong></div>
            <div className="usage-track"><span style={{ width: `${Math.min(searchCount * 5, 100)}%` }} /></div>
            <small>PRH:n avoin data</small>
          </div>
          <button className="profile-button">
            <span className="profile-avatar">A</span>
            <span className="workspace-copy"><strong>Alex Myyjä</strong><small>alex@yritys.fi</small></span>
            <span className="switcher-chevron">···</span>
          </button>
        </div>
      </aside>

      <main className="main-content" id="etusivu">
        <header className="topbar">
          <div className="breadcrumb">Työpöytä <span>/</span> <strong>Liidien haku</strong></div>
          <div className="demo-indicator"><span /> PRH-RAJAPINTA</div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">YRITYSHAKU · JULKISET LÄHTEET</p>
              <h1>Löydä seuraava asiakkaasi.</h1>
              <p className="heading-subtitle">Hae yrityksiä PRH:n toimiala- ja paikkakuntatiedoilla.</p>
            </div>
            <div className="heading-mark" aria-hidden="true"><span>01</span><i>↗</i></div>
          </section>

          <section className="search-panel" aria-labelledby="search-title">
            <div className="search-panel-heading">
              <div className="search-step">01</div>
              <div><h2 id="search-title">Millaisia yrityksiä etsit?</h2><p>Haku käyttää PRH:n avointa YTJ-rajapintaa.</p></div>
              <span className="demo-tag">API-HAKU</span>
            </div>
            <form className="search-form" onSubmit={handleSearch}>
              <label className="field field-query">
                <span>TOIMIALA / HAKUSANA</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="esim. teollisuus, energia" />
              </label>
              <label className="field">
                <span>PAIKKAKUNTA (VALINNAINEN)</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="esim. Vaasa" />
              </label>
              <label className="field">
                <span>MIN. LIIKEVAIHTO, M€</span>
                <input min="0" step="1" type="number" value={minimumRevenue} onChange={(event) => setMinimumRevenue(event.target.value)} />
              </label>
              <label className="field">
                <span>MIN. HENKILÖSTÖ</span>
                <input min="0" step="1" type="number" value={minimumEmployees} onChange={(event) => setMinimumEmployees(event.target.value)} />
              </label>
              <button className="search-button" type="submit" disabled={isLoading}><span>⌕</span> {isLoading ? "Haetaan..." : "Hae PRH:sta"} <b>↗</b></button>
            </form>
            <div className="search-footnote"><span className="info-dot">i</span> YTJ ei sisällä liikevaihtoa tai henkilöstömäärää. PRH:n XBRL-rajapinta kattaa vain osan tilinpäätöksistä.</div>
            {apiError && <p className="api-error" role="alert">{apiError}</p>}
          </section>

          <section className="results-section" id="liidit" aria-labelledby="results-title">
            <div className="results-heading">
              <div>
                <div className="results-title-line"><h2 id="results-title">Löydetyt yritykset</h2><span className="result-count">{visibleLeads.length.toString().padStart(2, "0")}</span></div>
                <p className="results-description">Haulla <strong>{lastSearch}</strong></p>
              </div>
              <div className="results-actions">
                {apiSource === "PRH YTJ + XBRL API" && <button className="export-button" onClick={restoreResearchList}>Tutkittu lista</button>}
                <button className="export-button" onClick={() => window.print()}><span>↓</span> Tulosta lista</button>
              </div>
            </div>

            <p className="results-description results-source-note">{apiSource === "PRH YTJ + XBRL API" ? "PRH-haku ei varmista yrityksen henkilöstömäärää tai liikevaihtoa. Tarkista lähteet ennen kontaktointia." : "Kehitystarve on arvio julkisista verkkolähteistä, ei vahvistettu ostohanke."}</p>

            <div className="results-toolbar">
              <div className="view-tabs" role="tablist" aria-label="Suodata tuloksia">
                <button role="tab" aria-selected={view === "all"} className={view === "all" ? "selected" : ""} onClick={() => setView("all")}>Kaikki <span>{matchingLeads.length.toString().padStart(2, "0")}</span></button>
                <button role="tab" aria-selected={view === "strong"} className={view === "strong" ? "selected" : ""} onClick={() => setView("strong")}>Vahva signaali <span>{matchingLeads.filter((lead) => lead.fit === "Vahva").length.toString().padStart(2, "0")}</span></button>
                <button role="tab" aria-selected={view === "saved"} className={view === "saved" ? "selected" : ""} onClick={() => setView("saved")}>Tallennetut <span>{matchingLeads.filter((lead) => saved.includes(lead.name)).length.toString().padStart(2, "0")}</span></button>
              </div>
              <span className="sort-label">LÄHDE <strong>{apiSource}</strong></span>
            </div>

            <div className="lead-list">
              {visibleLeads.length > 0 ? visibleLeads.map((lead, index) => (
                <article className="lead-row" key={lead.businessId}>
                  <span className="row-index">{(index + 1).toString().padStart(2, "0")}</span>
                  <div className={`company-mark ${lead.color}`}>{lead.initials}</div>
                  <div className="company-main">
                    <div className="company-name-line"><h3>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" title={`Avaa ${lead.name} verkkosivut`}>{lead.name}</a> : lead.name}</h3><span className="sample-label">{lead.businessId}</span></div>
                    <p>{lead.industry} <span>·</span> {lead.location} <span>·</span> {lead.employees === null ? "Ei saatavilla" : `${lead.employees} hlö`} <span>·</span> {lead.revenue === null ? "Liikevaihto ei saatavilla" : `${(lead.revenue / 1_000_000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} M€`}</p>
                  </div>
                  <div className="match-cell"><div className="match-line"><strong>{lead.fit ?? "Tarkistettava"}</strong></div><span className="fit-caption">{lead.revenue === null || lead.employees === null ? "Luvut tarkistettava" : lead.revenue > Number(minimumRevenue || 0) * 1_000_000 && lead.employees > Number(minimumEmployees || 0) ? "Täyttää rajat" : "Ei täytä rajoja"}</span></div>
                  <div className="reason-cell"><span className="signal-tag">{lead.signal}</span><p>{lead.reason}</p><div className="source-links">{lead.sources.map((source) => <a key={`${lead.businessId}-${source.url}`} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div></div>
                  <button className={`save-button ${saved.includes(lead.name) ? "is-saved" : ""}`} onClick={() => toggleSaved(lead.name)} aria-label={saved.includes(lead.name) ? `Poista ${lead.name} tallennetuista` : `Tallenna ${lead.name}`} title={saved.includes(lead.name) ? "Poista tallennetuista" : "Tallenna yritys"}>{saved.includes(lead.name) ? "★" : "☆"}</button>
                  {lead.website ? <a className="open-button" href={lead.website} target="_blank" rel="noreferrer" aria-label={`Avaa ${lead.name} verkkosivut`} title="Avaa yrityksen verkkosivut">↗</a> : <span />}
                </article>
              )) : (
                <div className="empty-state"><span>☆</span><h3>{view === "saved" ? "Ei vielä tallennettuja yrityksiä" : "Ei rajaukseen sopivia yrityksiä"}</h3><p>{view === "saved" ? "Tallenna kiinnostava yritys tähtipainikkeesta, niin löydät sen täältä." : "Kokeile laajentaa toimialahakua tai poista paikkakuntarajaus."}</p><button onClick={() => setView("all")}>Näytä kaikki tulokset</button></div>
              )}
            </div>
            <div className="list-footer"><span>Näytetään {visibleLeads.length} yritystä</span><span>PRH:n data päivittyy päivittäin · lähteet yrityskorteissa</span></div>
          </section>
          <footer className="page-footer"><span>POLKU <i>·</i> MYYNTIÄ, JOSSA ON SUUNTA</span><span>Yritystiedot: PRH · Kehityssignaalit: yritysten omat sivut</span></footer>
        </div>
      </main>
    </div>
  );
}
