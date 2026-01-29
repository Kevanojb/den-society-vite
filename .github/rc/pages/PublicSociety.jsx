import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabaseClient"; // adjust path to your client

export default function PublicSociety() {
  const { slug } = useParams();
  const [society, setSociety] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      setSociety(null);

      // IMPORTANT:
      // - .single() throws that "Cannot coerce..." error if 0 or >1 rows.
      // - Use maybeSingle() + limit(1) to be resilient.
      const { data, error } = await supabase
        .from("societies")
        .select("id,name,slug,description,logo_url") // choose fields that are safe public
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setError(error.message || "Failed to load society");
        return;
      }

      if (!data) {
        setError("Society not found");
        return;
      }

      setSociety(data);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Public society page</h2>
        <p>{error}</p>
        <p>
          <Link to="/">Go to sign in</Link>
        </p>
      </div>
    );
  }

  if (!society) {
    return (
      <div style={{ padding: 24 }}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>{society.name}</h1>
      {society.description ? <p>{society.description}</p> : null}

      <div style={{ marginTop: 16 }}>
        <Link to="/">Sign in</Link>
      </div>
    </div>
  );
}
