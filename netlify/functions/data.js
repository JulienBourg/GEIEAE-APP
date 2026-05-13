const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore("geieae-data");

  try {
    // GET — lire les données
    if (event.httpMethod === "GET") {
      const data = await store.get("appdata");
      if (!data) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ressources: [], projets: [], absences: [],
            horsProjets: [], ganttTaches: [], lignesProjets: [],
            heuresProjets: [], joursFeries: []
          })
        };
      }
      return { statusCode: 200, headers, body: data };
    }

    // POST — sauvegarder les données
    if (event.httpMethod === "POST") {
      await store.set("appdata", event.body);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: "Method not allowed" };

  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
