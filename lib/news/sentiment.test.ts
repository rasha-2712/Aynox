import { describe, expect, it } from "vitest";
import { formatIllustrativeConfidence } from "@/lib/news/format-confidence";
import { DemoLexiconSentimentClassifier } from "@/lib/news/sentiment";

describe("illustrative sentiment confidence", () => {
  it("formats a decimal score as a percentage exactly once", () => {
    expect(formatIllustrativeConfidence(0)).toBe("0%");
    expect(formatIllustrativeConfidence(0.35)).toBe("35%");
    expect(formatIllustrativeConfidence(0.82)).toBe("82%");
    expect(formatIllustrativeConfidence(1)).toBe("100%");
  });

  it("rejects values outside the decimal confidence boundaries", () => {
    expect(() => formatIllustrativeConfidence(-0.01)).toThrow(RangeError);
    expect(() => formatIllustrativeConfidence(1.01)).toThrow(RangeError);
    expect(() => formatIllustrativeConfidence(Number.NaN)).toThrow(RangeError);
    expect(() => formatIllustrativeConfidence(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("keeps classifier confidence within [0, 1] for each assessment status", () => {
    const classifier = new DemoLexiconSentimentClassifier();
    const assessments = [
      classifier.classify({ headline: "The board met in London.", summary: "", body: "" }),
      classifier.classify({ headline: "Revenue increased, but profits fell.", summary: "", body: "" }),
      classifier.classify({ headline: "Short", summary: "", body: "" }),
      classifier.classify({ headline: "Expansion growth improved efficient delivery across operations.", summary: "", body: "" })
    ];
    expect(assessments.map((item) => item.status)).toEqual(["classified", "ambiguous", "insufficient-content", "classified"]);
    for (const assessment of assessments) {
      expect(assessment.heuristicConfidence).toBeGreaterThanOrEqual(0);
      expect(assessment.heuristicConfidence).toBeLessThanOrEqual(1);
      expect(assessment.calibrated).toBe(false);
    }
    expect(assessments.at(-1)?.heuristicConfidence).toBe(0.82);
  });
});
