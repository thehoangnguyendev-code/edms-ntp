import { Question } from "../../types";

/**
 * Redistributes points evenly across all questions to total 10 points.
 * Rounds each question's points to 2 decimal places.
 */
export const redistributePoints = (questions: Question[]): Question[] => {
    if (questions.length === 0) return questions;
    
    const pointsPerQuestion = parseFloat((10 / questions.length).toFixed(2));
    
    return questions.map(q => ({ ...q, points: pointsPerQuestion }));
};
