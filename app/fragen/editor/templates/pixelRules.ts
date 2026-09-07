export function pixelRules(mode: "CHALLENGE" | "STAGED") {
  return mode === "STAGED" ? {
    title: "Früh erkannt? Mehr Punkte.",
    lines: ["Drei Bildstufen · je 20 Sekunden", "Stufe 3: 3 Punkte · Stufe 2: 2 Punkte · Stufe 1: 1 Punkt", "Antwort eingeben und bei Bedarf ändern.", "Später geändert? Die spätere Stufe zählt. Nur die letzte Antwort wird gewertet."],
  } : {
    title: "Erkennen. Antworten. Stoppen.",
    lines: ["Das Bild wird in drei Stufen klarer.", "In Stufe 3 oder 2 könnt ihr für alle stoppen. Eure Antwort ist dann gesperrt.", "Die anderen Teams haben noch 20 Sekunden.", "Richtig: 3 / 2 / 1 Punkte. Allein richtiger Stop: 6 / 4. Falscher Stop: −1."],
  };
}
