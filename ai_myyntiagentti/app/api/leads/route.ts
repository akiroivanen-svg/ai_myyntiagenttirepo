type Description = { languageCode: string; description?: string | null };

type PrhCompany = {
  businessId?: { value?: string };
  names?: { name: string; type: string; version: number }[];
  mainBusinessLine?: { descriptions?: Description[] };
  website?: { url?: string };
  addresses?: {
    type: number;
    postOffices?: { city: string; languageCode: string }[];
  }[];
  tradeRegisterStatus?: string;
  endDate?: string | null;
};

type Research = {
  revenue: number;
  employees: number;
  signal: string;
  reason: string;
  sources: { label: string; url: string }[];
};

const researchByBusinessId: Record<string, Research> = {
  "1571996-6": {
    revenue: 103_907_000,
    employees: 445,
    signal: "Portaalin jatkokehitys",
    reason: "Asiakasportaali ja digitaalinen kaksonen ovat käytössä. Varaosatilaus ja palvelun laajentaminen ovat yhtiön mukaan seuraavia kehityskohteita.",
    sources: [
      { label: "Asiakasportaali", url: "https://veo.fi/news/veos-lifecycle-support-gains-momentum-with-new-customer-portal/" },
      { label: "VEOCyber", url: "https://veo.fi/news/veo-launches-veocyber-vulnerability-monitoring-for-critical-systems/" },
      { label: "Talousluvut", url: "https://www.asiakastieto.fi/yritykset/fi/veo-oy/15719966/taloustiedot" },
    ],
  },
  "0535085-1": {
    revenue: 155_232_000,
    employees: 386,
    signal: "Ohjelmistokehitys + yritysosto",
    reason: "PEMA Core -ohjelmistoperhettä kehitetään aktiivisesti. Mach Machines -yritysosto laajensi toimintaa Pohjois-Amerikassa; ohjelmistot tehdään kuitenkin omalla tiimillä.",
    sources: [
      { label: "PEMA Core", url: "https://pemamek.com/fi/pema-core/" },
      { label: "Yritysosto", url: "https://pemamek.com/fi/uutiset/pemamek-vahvistaa-asemaansa-pohjois-amerikassa-ostamalla-mach-machinesin-liiketoiminnan/" },
      { label: "Talousluvut", url: "https://www.asiakastieto.fi/yritykset/fi/pemamek-oy/05350851/taloustiedot" },
    ],
  },
  "1507705-1": {
    revenue: 60_610_000,
    employees: 267,
    signal: "Ohjelmistointegraatiot",
    reason: "MMS-ohjelmisto yhdistää tuotannon ERP-, CAM- ja TDM-järjestelmiin sekä koneisiin. Ulkoisesta kehityshankinnasta ei löytynyt julkista ilmoitusta.",
    sources: [
      { label: "MMS-ohjelmisto", url: "https://www.fastems.com/offering/mms/" },
      { label: "Talousluvut", url: "https://www.asiakastieto.fi/yritykset/fi/fastems-oy-ab/15077051/taloustiedot" },
    ],
  },
};

function getCompanyName(company: PrhCompany) {
  const currentName = company.names?.find((name) => name.type === "1" && name.version === 1);
  return currentName?.name ?? company.names?.find((name) => name.type === "1")?.name ?? "Nimetön yritys";
}

function getCompanyLocation(company: PrhCompany) {
  const address = company.addresses?.find((item) => item.type === 1) ?? company.addresses?.[0];
  return address?.postOffices?.find((office) => office.languageCode === "1")?.city
    ?? address?.postOffices?.[0]?.city
    ?? "Ei ilmoitettu";
}

function getOfficialWebsite(rawWebsite?: string) {
  if (!rawWebsite) return null;
  try {
    const url = new URL(rawWebsite.startsWith("http") ? rawWebsite : `https://${rawWebsite}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const industry = requestUrl.searchParams.get("industry")?.trim().slice(0, 80) ?? "";
  const location = requestUrl.searchParams.get("location")?.trim().slice(0, 50) ?? "";

  if (!industry && !location) {
    return Response.json({ error: "Anna toimiala tai paikkakunta." }, { status: 400 });
  }

  const companies = new Map<string, PrhCompany>();
  let providerResultCount = 0;

  try {
    for (let page = 1; page <= 8 && companies.size < 12; page += 1) {
      const prhUrl = new URL("https://avoindata.prh.fi/opendata-ytj-api/v3/companies");
      if (industry) prhUrl.searchParams.set("mainBusinessLine", industry);
      if (location) prhUrl.searchParams.set("location", location);
      prhUrl.searchParams.set("lang", "fi");
      prhUrl.searchParams.set("page", page.toString());

      const response = await fetch(prhUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) {
        return Response.json({ error: `PRH-rajapinta palautti virheen ${response.status}.` }, { status: 502 });
      }

      const result = await response.json() as { totalResults?: number; companies?: PrhCompany[] };
      providerResultCount = result.totalResults ?? 0;
      const pageCompanies = result.companies ?? [];
      for (const company of pageCompanies) {
        const businessId = company.businessId?.value;
        if (businessId && !company.endDate && company.tradeRegisterStatus === "1") {
          companies.set(businessId, company);
        }
      }
      if (pageCompanies.length === 0 || page * 100 >= providerResultCount) break;
    }
  } catch {
    return Response.json({ error: "PRH-rajapintaan ei saatu yhteyttä. Yritä hetken kuluttua uudelleen." }, { status: 502 });
  }

  const leads = await Promise.all([...companies.entries()].slice(0, 12).map(async ([businessId, company]) => {
    const knownResearch = researchByBusinessId[businessId];
    let financialReportsAvailable = false;

    try {
      const financialUrl = new URL("https://avoindata.prh.fi/opendata-xbrl-api/v3/financials");
      financialUrl.searchParams.set("businessId", businessId);
      const financialResponse = await fetch(financialUrl, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
      if (financialResponse.ok) {
        const financialResult = await financialResponse.json() as { totalResults?: number };
        financialReportsAvailable = (financialResult.totalResults ?? 0) > 0;
      }
    } catch {
      financialReportsAvailable = false;
    }

    const website = getOfficialWebsite(company.website?.url);
    const businessLine = company.mainBusinessLine?.descriptions?.find((item) => item.languageCode === "1")?.description
      ?? "Toimialaa ei ilmoitettu";
    const prhSource = `https://avoindata.prh.fi/opendata-ytj-api/v3/companies?businessId=${encodeURIComponent(businessId)}&lang=fi`;

    return {
      name: getCompanyName(company),
      businessId,
      industry: businessLine,
      location: getCompanyLocation(company),
      website,
      revenue: knownResearch?.revenue ?? null,
      employees: knownResearch?.employees ?? null,
      signal: knownResearch?.signal ?? (financialReportsAvailable ? "Tilinpäätös saatavilla" : "Verkkosivu tarkistettava"),
      reason: knownResearch?.reason ?? "YTJ vahvisti yrityksen perustiedot. Maksuton PRH-rajapinta ei sisällä henkilöstö- eikä liikevaihtolukua; tarkista verkkosivulta mahdolliset kehityssignaalit.",
      financialReportsAvailable,
      sources: [
        { label: "YTJ / PRH", url: prhSource },
        ...(website ? [{ label: "Yrityksen verkkosivu", url: website }] : []),
        ...(knownResearch?.sources ?? []),
        ...(!knownResearch ? [{ label: "PRH:n tilinpäätös-API", url: "https://avoindata.prh.fi/fi/xbrl/swagger-ui" }] : []),
      ],
    };
  }));

  return Response.json({
    leads,
    providerResultCount,
    returnedCount: leads.length,
    source: "PRH YTJ avoin data",
    sourceUpdatedDaily: true,
  });
}