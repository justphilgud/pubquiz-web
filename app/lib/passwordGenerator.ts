import { TEAM_PASSWORT_WOERTER } from "@/app/lib/teamPasswortWoerter";

export function generateMemorablePassword() {
  const word1 =
    TEAM_PASSWORT_WOERTER[
      Math.floor(Math.random() * TEAM_PASSWORT_WOERTER.length)
    ];

  let word2 =
    TEAM_PASSWORT_WOERTER[
      Math.floor(Math.random() * TEAM_PASSWORT_WOERTER.length)
    ];

  while (word2 === word1 && TEAM_PASSWORT_WOERTER.length > 1) {
    word2 =
      TEAM_PASSWORT_WOERTER[
        Math.floor(Math.random() * TEAM_PASSWORT_WOERTER.length)
      ];
  }

  const number = Math.floor(Math.random() * 90) + 10;

  return `${word1}${word2}${number}`;
}
