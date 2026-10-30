export type PracticeQuestion = {
  category: string;
  question: string;
  focus: string;
};

export function generateInterviewQuestions(role: string, skills: string[]): PracticeQuestion[] {
  const title = role.trim() || "your target role";
  const examples = skills.slice(0, 4);
  const skillPrompt = examples.length
    ? `Choose one example that demonstrates ${examples.join(", ")}.`
    : "Choose one example from your work, study, or projects.";
  return [
    { category: "Role motivation", question: `What interests you about working as a ${title}?`, focus: "Connect the role to work you have actually enjoyed or want to learn." },
    { category: "Relevant experience", question: `Which experience best prepared you for a ${title} role?`, focus: "Explain the context, your contribution, and what changed." },
    { category: "Skill evidence", question: `Tell me about a time you used a relevant skill to solve a problem.`, focus: skillPrompt },
    { category: "Problem solving", question: "Describe a difficult decision you made with incomplete information.", focus: "Share the options you considered, your reasoning, and what you learned." },
    { category: "Collaboration", question: "Tell me about a time you disagreed with a teammate about how to approach work.", focus: "Show how you listened, made a decision, and kept the work moving." },
    { category: "Learning", question: "What is one skill you are actively improving, and how are you practicing it?", focus: "Name a practical routine and a way you can tell you are making progress." },
    { category: "Project deep dive", question: "Walk me through a project you are proud of, from the first problem to the result.", focus: "Be clear about your own contribution and any evidence of the outcome." },
    { category: "Questions for the team", question: "What would you want to understand about the team before deciding whether this role is right for you?", focus: "Ask about the work, support, expectations, or how success is reviewed." },
  ];
}
