"use client";

import { Button, Input, Select, Textarea } from "@/components/ui";
import type {
  StorybookConfiguration,
  StorybookMemoryAsset,
  StorybookPerson,
  TemplateAssetReference,
} from "@/app/rendering/templateRegistry";

type Props = {
  value: StorybookConfiguration;
  onChange: (value: StorybookConfiguration) => void;
};

function nextId(prefix: string, ids: readonly string[]) {
  let number = ids.length + 1;
  while (ids.includes(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function move<T>(items: readonly T[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return [...items];
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function StorybookEditor({ value, onChange }: Props) {
  function updatePerson(index: number, patch: Partial<StorybookPerson>) {
    onChange({ ...value, people: value.people.map((person, itemIndex) => itemIndex === index ? { ...person, ...patch } : person) });
  }

  function addPerson() {
    const id = nextId("person", value.people.map((person) => person.id));
    onChange({ ...value, people: [...value.people, { id, name: "", age: null, subtitle: null, portrait: null }] });
  }

  function removePerson(index: number) {
    const person = value.people[index];
    const hasAssignments = value.assets.some((asset) => asset.personIds.includes(person.id)) || value.anecdotes.some((item) => item.personIds.includes(person.id)) || value.chapters.some((item) => item.personIds.includes(person.id));
    if (hasAssignments && !window.confirm(`${person.name || "Diese Person"} ist Bildern oder Erinnerungen zugeordnet. Person entfernen und diese Zuordnungen ebenfalls lösen?`)) return;
    const without = (ids: string[]) => ids.filter((id) => id !== person.id);
    onChange({
      ...value,
      people: value.people.filter((_, itemIndex) => itemIndex !== index),
      assets: value.assets.map((asset) => ({ ...asset, personIds: without(asset.personIds) })),
      anecdotes: value.anecdotes.map((item) => ({ ...item, personIds: without(item.personIds) })),
      chapters: value.chapters.map((item) => ({ ...item, personIds: without(item.personIds) })),
    });
  }

  function addAsset() {
    const asset: StorybookMemoryAsset = {
      id: nextId("memory", value.assets.map((item) => item.id)),
      source: "/medien/template-preview.svg",
      role: "MEMORY",
      personIds: [],
      alt: "Persönliche Erinnerung",
      caption: null,
      year: null,
      order: value.assets.length,
    };
    onChange({ ...value, assets: [...value.assets, asset] });
  }

  function updateAsset(index: number, patch: Partial<StorybookMemoryAsset>) {
    onChange({ ...value, assets: value.assets.map((asset, itemIndex) => itemIndex === index ? { ...asset, ...patch } : asset) });
  }

  function togglePerson(ids: string[], personId: string) {
    return ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId];
  }

  return (
    <div className="space-y-6" data-storybook-editor>
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
        <h3 className="font-bold">Anlass und gemeinsamer Titel</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Gemeinsamer Titel<Input value={value.sharedTitle} onChange={(event) => onChange({ ...value, sharedTitle: event.target.value })} className="mt-1 min-h-11" placeholder="Migge & Paul feiern gemeinsam" /></label>
          <label className="text-sm font-semibold">Motto<Input value={value.motto} onChange={(event) => onChange({ ...value, motto: event.target.value })} className="mt-1 min-h-11" /></label>
          <label className="text-sm font-semibold">Untertitel<Input value={value.subtitle} onChange={(event) => onChange({ ...value, subtitle: event.target.value })} className="mt-1 min-h-11" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Materialwelt<Select value={value.material} onChange={(event) => onChange({ ...value, material: event.target.value as StorybookConfiguration["material"] })} className="mt-1 min-h-11"><option value="CREAM_PAPER">Creme-Papier</option><option value="LIGHT_ALBUM">Helles Album</option><option value="LINEN">Leinen</option><option value="DARK_ALBUM">Dunkles Fotoalbum</option><option value="MAGAZINE_WHITE">Magazinweiß</option></Select></label>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Gefeierte Personen</h3><p className="text-sm text-slate-600">Alle Personen sind gleichwertig. Reihenfolge und stabile IDs steuern die Komposition.</p></div><Button type="button" variant="secondary" onClick={addPerson}>Person hinzufügen</Button></div>
        <div className="mt-3 space-y-3">
          {value.people.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Titelmodus ohne einzelne Personen. Ein gemeinsamer Titel bleibt erforderlich.</p>}
          {value.people.map((person, index) => (
            <article key={person.id} data-storybook-person={person.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><strong>Person {index + 1}</strong><div className="flex gap-1"><Button type="button" variant="ghost" disabled={index === 0} onClick={() => onChange({ ...value, people: move(value.people, index, -1) })} aria-label={`${person.name || `Person ${index + 1}`} nach vorne verschieben`}>↑</Button><Button type="button" variant="ghost" disabled={index === value.people.length - 1} onClick={() => onChange({ ...value, people: move(value.people, index, 1) })} aria-label={`${person.name || `Person ${index + 1}`} nach hinten verschieben`}>↓</Button><Button type="button" variant="danger" onClick={() => removePerson(index)}>Entfernen</Button></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">Name<Input value={person.name} onChange={(event) => updatePerson(index, { name: event.target.value })} className="mt-1 min-h-11" required /></label>
                <label className="text-sm font-semibold">Alter (optional)<Input value={person.age ?? ""} onChange={(event) => updatePerson(index, { age: event.target.value || null })} className="mt-1 min-h-11" /></label>
                <label className="text-sm font-semibold">Untertitel (optional)<Input value={person.subtitle ?? ""} onChange={(event) => updatePerson(index, { subtitle: event.target.value || null })} className="mt-1 min-h-11" /></label>
                <label className="text-sm font-semibold">Porträtpfad (optional)<Input value={person.portrait ?? ""} onChange={(event) => updatePerson(index, { portrait: (event.target.value || null) as TemplateAssetReference | null })} className="mt-1 min-h-11 font-mono text-xs" placeholder="/medien/bilder/..." /></label>
                <p className="text-xs text-slate-500 sm:col-span-2">Stabile ID: <code>{person.id}</code></p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Kuratierte Erinnerungsbilder</h3><p className="text-sm text-slate-600">Rolle, Alternativtext und Personenbezug bestimmen die Auswahl – nicht Gesichtserkennung.</p></div><Button type="button" variant="secondary" onClick={addAsset}>Erinnerungsbild hinzufügen</Button></div>
        <div className="mt-3 space-y-3">
          {value.assets.map((asset, index) => (
            <article key={asset.id} data-storybook-asset={asset.id} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2">Sicherer Bildpfad<Input value={asset.source} onChange={(event) => updateAsset(index, { source: event.target.value as TemplateAssetReference })} className="mt-1 min-h-11 font-mono text-xs" /></label>
                <label className="text-sm font-semibold">Rolle<Select value={asset.role} onChange={(event) => updateAsset(index, { role: event.target.value as StorybookMemoryAsset["role"] })} className="mt-1 min-h-11"><option value="PORTRAIT">Personenporträt</option><option value="GROUP">Gruppenbild</option><option value="MEMORY">Allgemeine Erinnerung</option><option value="SOLUTION">Auflösungserinnerung</option></Select></label>
                <label className="text-sm font-semibold">Jahr (optional)<Input value={asset.year ?? ""} onChange={(event) => updateAsset(index, { year: event.target.value || null })} className="mt-1 min-h-11" /></label>
                <label className="text-sm font-semibold">Alternativtext<Input value={asset.alt} onChange={(event) => updateAsset(index, { alt: event.target.value })} className="mt-1 min-h-11" /></label>
                <label className="text-sm font-semibold">Bildunterschrift (optional)<Input value={asset.caption ?? ""} onChange={(event) => updateAsset(index, { caption: event.target.value || null })} className="mt-1 min-h-11" /></label>
              </div>
              {value.people.length > 0 && <fieldset className="mt-3"><legend className="text-sm font-semibold">Personenzuordnung (leer = allgemein)</legend><div className="mt-2 flex flex-wrap gap-3">{value.people.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asset.personIds.includes(person.id)} onChange={() => updateAsset(index, { personIds: togglePerson(asset.personIds, person.id) })} />{person.name || person.id}</label>)}</div></fieldset>}
              <div className="mt-3 flex justify-end"><Button type="button" variant="danger" onClick={() => onChange({ ...value, assets: value.assets.filter((_, itemIndex) => itemIndex !== index) })}>Bild entfernen</Button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">Anekdoten</h3><p className="text-xs text-slate-500">Nur gepflegte Texte werden gezeigt.</p></div><Button type="button" variant="secondary" onClick={() => onChange({ ...value, anecdotes: [...value.anecdotes, { id: nextId("anecdote", value.anecdotes.map((item) => item.id)), text: "", personIds: [], year: null }] })}>Hinzufügen</Button></div>{value.anecdotes.map((item, index) => <div key={item.id} className="mt-3 rounded-lg bg-slate-50 p-3"><label className="text-sm font-semibold">Text<Textarea value={item.text} onChange={(event) => onChange({ ...value, anecdotes: value.anecdotes.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry) })} rows={2} className="mt-1" /></label><Button type="button" variant="ghost" className="mt-2" onClick={() => onChange({ ...value, anecdotes: value.anecdotes.filter((_, itemIndex) => itemIndex !== index) })}>Entfernen</Button></div>)}</div>
        <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">Kapitel</h3><p className="text-xs text-slate-500">Vorbereitet für Runden- und Abschnittsintros.</p></div><Button type="button" variant="secondary" onClick={() => onChange({ ...value, chapters: [...value.chapters, { id: nextId("chapter", value.chapters.map((item) => item.id)), title: "", subtitle: null, personIds: [], order: value.chapters.length }] })}>Hinzufügen</Button></div>{value.chapters.map((item, index) => <div key={item.id} className="mt-3 rounded-lg bg-slate-50 p-3"><label className="text-sm font-semibold">Titel<Input value={item.title} onChange={(event) => onChange({ ...value, chapters: value.chapters.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry) })} className="mt-1" /></label><Button type="button" variant="ghost" className="mt-2" onClick={() => onChange({ ...value, chapters: value.chapters.filter((_, itemIndex) => itemIndex !== index) })}>Entfernen</Button></div>)}</div>
      </section>
    </div>
  );
}
