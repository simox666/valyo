// Écriture compacte de la banque de questions : un fichier par thème.
// Dans ces fichiers la bonne réponse est toujours écrite en premier ; les propositions
// sont mélangées à chaque tirage (voir tirage.ts), jamais affichées dans cet ordre.

import type { QuizQuestion, TrueFalseStatement } from "../questions.ts";

export interface ThemeBank {
  mcq: QuizQuestion[];
  vf: TrueFalseStatement[];
  /** Question à choix : la bonne réponse, puis trois mauvaises, puis l'explication. */
  m: (question: string, good: string, wrong: [string, string, string], explain: string) => void;
  /** Affirmation vraie ou fausse, avec son explication. */
  v: (statement: string, isTrue: boolean, explain: string) => void;
}

export function banque(theme: string): ThemeBank {
  const mcq: QuizQuestion[] = [];
  const vf: TrueFalseStatement[] = [];
  return {
    mcq,
    vf,
    m: (question, good, wrong, explain) => { mcq.push({ theme, question, choices: [good, ...wrong], answer: 0, explain }); },
    v: (statement, isTrue, explain) => { vf.push({ theme, statement, isTrue, explain }); },
  };
}
