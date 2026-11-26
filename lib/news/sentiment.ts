import type { NewsArticleInput, NewsSentiment, NewsSentimentLabel } from "@/types/news";

export interface SentimentClassifier {
  readonly classifierName: string;
  classify(article: Pick<NewsArticleInput, "headline" | "summary" | "body">): NewsSentiment;
}

const positiveTerms = ["expand", "expansion", "improved", "improve", "improvement", "stronger", "growth", "gain", "gains", "efficient", "efficiency", "successfully", "broader adoption", "increase", "increased", "increases", "rise", "rises", "rose"];
const negativeTerms = ["delay", "delays", "delayed", "uncertainty", "uncertain", "pressure", "disruption", "disrupt", "risk", "risks", "constraint", "constraints", "higher cost", "cost pressure", "longer delivery", "fall", "falls", "fell", "decline", "declines", "declined", "decrease", "decreases", "decreased"];
const negationWords = new Set(["not", "no", "never", "without", "neither", "isn't", "wasn't", "aren't", "weren't", "doesn't", "didn't", "hasn't", "haven't", "can't"]);
const demoBoilerplate = /fictional scenario for the aynox interface demonstration\. this is not a report of a real event and has no external source\./gi;

function termMatches(text: string, term: string): Array<{ index: number; negated: boolean }> {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
  return [...text.matchAll(pattern)].map((match) => {
    const index = match.index ?? 0;
    const sentenceStart = Math.max(text.lastIndexOf(".", index), text.lastIndexOf("!", index), text.lastIndexOf("?", index), text.lastIndexOf(";", index)) + 1;
    const precedingWords = text.slice(sentenceStart, index).toLocaleLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    const negated = precedingWords.slice(-3).some((word) => negationWords.has(word));
    return { index, negated };
  });
}

function evidenceFor(text: string, terms: string[], polarity: "positive" | "negative") {
  const evidence: string[] = [];
  for (const term of terms) {
    for (const match of termMatches(text, term)) {
      const effectivePolarity = match.negated ? (polarity === "positive" ? "negative" : "positive") : polarity;
      evidence.push(`${effectivePolarity}:${match.negated ? `not ${term}` : term}`);
    }
  }
  return evidence;
}

function meaningfulText(article: Pick<NewsArticleInput, "headline" | "summary" | "body">): string {
  return [article.headline, article.summary, article.body.replace(demoBoilerplate, " ")]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export class DemoLexiconSentimentClassifier implements SentimentClassifier {
  readonly classifierName = "Aynox transparent lexicon heuristic (demo)";

  classify(article: Pick<NewsArticleInput, "headline" | "summary" | "body">): NewsSentiment {
    const text = meaningfulText(article);
    const wordCount = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
    const positiveEvidence = [...evidenceFor(text, positiveTerms, "positive"), ...evidenceFor(text, negativeTerms, "negative").filter((term) => term.startsWith("positive:"))];
    const negativeEvidence = [...evidenceFor(text, negativeTerms, "negative"), ...evidenceFor(text, positiveTerms, "positive").filter((term) => term.startsWith("negative:"))];
    const positive = positiveEvidence.filter((term) => term.startsWith("positive:")).map((term) => term.slice("positive:".length));
    const negative = negativeEvidence.filter((term) => term.startsWith("negative:")).map((term) => term.slice("negative:".length));
    let label: NewsSentimentLabel = "Neutral";
    let status: NewsSentiment["status"] = "classified";
    let heuristicConfidence = 0.35;
    let explanation = "No configured positive or negative terms were found; this content is classified as neutral by the demo heuristic.";

    if (wordCount < 3) {
      status = "insufficient-content";
      explanation = "There is too little substantive article text for this simple heuristic; insufficient content is kept separate from neutral sentiment.";
      heuristicConfidence = 0;
    } else if (positive.length > 0 && negative.length > 0) {
      status = "ambiguous";
      heuristicConfidence = 0.5;
      explanation = `Both positive evidence (${positive.join(", ")}) and negative evidence (${negative.join(", ")}) appear; no directional label is assigned.`;
    } else if (positive.length > 0) {
      label = "Positive";
      heuristicConfidence = Math.min(0.82, 0.62 + (positive.length - 1) * 0.08);
      explanation = `Positive label based on configured wording: ${positive.join(", ")}. This describes text tone only.`;
    } else if (negative.length > 0) {
      label = "Negative";
      heuristicConfidence = Math.min(0.82, 0.62 + (negative.length - 1) * 0.08);
      explanation = `Negative label based on configured wording: ${negative.join(", ")}. This describes text tone only.`;
    }

    return {
      label, explanation, matchedPositiveTerms: positive, matchedNegativeTerms: negative,
      heuristicConfidence, status, classifier: this.classifierName, calibrated: false
    };
  }
}

export const demoSentimentClassifier: SentimentClassifier = new DemoLexiconSentimentClassifier();
