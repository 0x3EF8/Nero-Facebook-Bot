/**
 * Pairing Utilities Module
 * Handles intelligent gender-based pairing of group members
 * Uses AI to analyze names and create male-female pairs
 * 
 * @module utils/pairing
 */

const { gemini } = require("../core/gemini");

/**
 * Analyze names and determine gender using AI
 * @param {Array<{id: string, name: string}>} members - Array of members
 * @returns {Promise<{males: Array, females: Array, unknown: Array}>}
 */
async function analyzeGenders(members) {
  if (members.length === 0) {
    return { males: [], females: [], unknown: [] };
  }

  const nameList = members.map((m, i) => `${i + 1}. ${m.name}`).join("\n");

  const prompt = `Analyze these names and classify each as male (M), female (F), or unknown (U) based on the name.
Consider cultural naming conventions from Philippines, Western, Asian, and other cultures.
Common Filipino male names: Jay, John, Mark, Michael, James, Carlo, Rafael, etc.
Common Filipino female names: Maria, Ana, Joy, Grace, Rose, Angel, etc.
Unisex or unclear names should be marked as U.

Names to analyze:
${nameList}

RESPOND ONLY with a JSON array in this exact format (no other text):
[{"index": 1, "gender": "M"}, {"index": 2, "gender": "F"}, ...]

Where gender is:
- "M" for male names
- "F" for female names  
- "U" for unknown/unisex names`;

  try {
    const result = await gemini.generate(prompt);
    const responseText = result?.response?.text?.() || "";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const genderData = JSON.parse(jsonMatch[0]);
    
    const males = [];
    const females = [];
    const unknown = [];

    for (const item of genderData) {
      const member = members[item.index - 1];
      if (!member) continue;

      if (item.gender === "M") {
        males.push(member);
      } else if (item.gender === "F") {
        females.push(member);
      } else {
        unknown.push(member);
      }
    }

    return { males, females, unknown };
  } catch (error) {
    console.error("Gender analysis failed:", error.message);
    // Fallback: treat all as unknown
    return { males: [], females: [], unknown: members };
  }
}

/**
 * Generate intelligent male-female pairs from group members
 * @param {Map} allMembers - Map of userID -> userName
 * @param {string} senderID - ID of user requesting pairs (optional)
 * @param {boolean} includeSender - Whether to include sender in random pairing
 * @returns {Promise<{pairs: Array, stats: Object}>}
 */
async function generateRandomPairs(allMembers, senderID = null, includeSender = true) {
  const membersArray = Array.from(allMembers.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  // If pairing sender with someone
  if (senderID && !includeSender) {
    const sender = membersArray.find((m) => m.id === senderID);
    const others = membersArray.filter((m) => m.id !== senderID);

    if (!sender || others.length === 0) {
      return { pairs: [], stats: null };
    }

    // Analyze genders
    const { males, females, unknown } = await analyzeGenders([sender, ...others]);
    
    // Determine sender's gender
    const senderIsMale = males.some((m) => m.id === senderID);
    const senderIsFemale = females.some((m) => m.id === senderID);

    // Find opposite gender matches
    let potentialMatches = [];
    if (senderIsMale) {
      potentialMatches = females.filter((m) => m.id !== senderID);
    } else if (senderIsFemale) {
      potentialMatches = males.filter((m) => m.id !== senderID);
    } else {
      // Unknown gender - try opposite from unknown pool or anyone
      potentialMatches = [...males, ...females].filter((m) => m.id !== senderID);
    }

    // If no opposite gender found, use anyone
    if (potentialMatches.length === 0) {
      potentialMatches = others;
    }

    const randomIndex = Math.floor(Math.random() * potentialMatches.length);
    const match = potentialMatches[randomIndex];

    const senderGender = senderIsMale ? "♂️" : senderIsFemale ? "♀️" : "❓";
    const matchGender = males.some((m) => m.id === match.id) ? "♂️" : 
                       females.some((m) => m.id === match.id) ? "♀️" : "❓";

    return {
      pairs: [{ 
        person1: { ...sender, gender: senderGender }, 
        person2: { ...match, gender: matchGender } 
      }],
      stats: {
        males: males.length,
        females: females.length,
        unknown: unknown.length,
        intelligentMatch: senderIsMale || senderIsFemale
      }
    };
  }

  // Random pairing of all members - prioritize male-female pairs
  const { males, females, unknown } = await analyzeGenders(membersArray);
  
  const pairs = [];
  const usedIds = new Set();

  // Shuffle arrays for randomness
  const shuffledMales = [...males].sort(() => Math.random() - 0.5);
  const shuffledFemales = [...females].sort(() => Math.random() - 0.5);
  const shuffledUnknown = [...unknown].sort(() => Math.random() - 0.5);

  // First, create male-female pairs
  const minPairs = Math.min(shuffledMales.length, shuffledFemales.length);
  for (let i = 0; i < minPairs; i++) {
    pairs.push({
      person1: { ...shuffledMales[i], gender: "♂️" },
      person2: { ...shuffledFemales[i], gender: "♀️" },
    });
    usedIds.add(shuffledMales[i].id);
    usedIds.add(shuffledFemales[i].id);
  }

  // Collect remaining unpaired members
  const remaining = [
    ...shuffledMales.filter((m) => !usedIds.has(m.id)).map((m) => ({ ...m, gender: "♂️" })),
    ...shuffledFemales.filter((m) => !usedIds.has(m.id)).map((m) => ({ ...m, gender: "♀️" })),
    ...shuffledUnknown.map((m) => ({ ...m, gender: "❓" })),
  ].sort(() => Math.random() - 0.5);

  // Pair remaining members
  for (let i = 0; i < remaining.length - 1; i += 2) {
    pairs.push({
      person1: remaining[i],
      person2: remaining[i + 1],
    });
  }

  // If odd number, last person is solo
  if (remaining.length % 2 !== 0) {
    pairs.push({
      person1: remaining[remaining.length - 1],
      person2: null,
    });
  }

  return {
    pairs,
    stats: {
      males: males.length,
      females: females.length,
      unknown: unknown.length,
      maleFemaleMatches: minPairs,
    }
  };
}

/**
 * Use Gemini AI to analyze love compatibility between two people
 * @param {string} name1 - First person's name
 * @param {string} gender1 - First person's gender (♂️/♀️/❓)
 * @param {string} name2 - Second person's name
 * @param {string} gender2 - Second person's gender (♂️/♀️/❓)
 * @returns {Promise<{percent: number, message: string}>}
 */
async function analyzeLoveCompatibility(name1, gender1, name2, gender2) {
  const prompt = `You are a fun love compatibility analyzer. Analyze the compatibility between these two people based on their names:

Person 1: ${name1} (${gender1 === "♂️" ? "Male" : gender1 === "♀️" ? "Female" : "Unknown gender"})
Person 2: ${name2} (${gender2 === "♂️" ? "Male" : gender2 === "♀️" ? "Female" : "Unknown gender"})

Consider:
- Name compatibility and how they sound together
- Letter matching and numerology vibes
- Cultural naming patterns
- Fun romantic chemistry analysis

RESPOND ONLY with JSON in this exact format (no other text):
{"percent": 85, "message": "Your creative fun romantic message here"}

Rules:
- percent must be between 50-100
- message should be 1 short sentence, fun and romantic with emojis
- IMPORTANT: Your message MUST always end with "sana all 😍" at the very end
- Be creative and different each time`;

  try {
    const result = await gemini.generate(prompt);
    const responseText = result?.response?.text?.() || "";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const data = JSON.parse(jsonMatch[0]);
    return {
      percent: Math.min(100, Math.max(50, data.percent || 75)),
      message: data.message || "Love is in the air! 💕"
    };
  } catch (error) {
    console.error("Love compatibility analysis failed:", error.message);
    // Fallback
    const fallbackPercent = Math.floor(Math.random() * 31) + 70;
    return {
      percent: fallbackPercent,
      message: "The stars align for you two! ✨"
    };
  }
}

/**
 * Format pairs for display message with gender icons
 * @param {Array} pairs - Array of pairs
 * @param {Object} stats - Gender statistics
 * @returns {Promise<string>} Formatted message
 */
async function formatPairsMessage(pairs, stats = null) {
  if (pairs.length === 0) return "No pairs could be generated.";

  const lines = [];
  
  for (let index = 0; index < pairs.length; index++) {
    const pair = pairs[index];
    if (pair.person2) {
      const p1 = `${pair.person1.gender || ""} ${pair.person1.name}`.trim();
      const p2 = `${pair.person2.gender || ""} ${pair.person2.name}`.trim();
      
      // Get AI-powered love analysis
      const { percent, message } = await analyzeLoveCompatibility(
        pair.person1.name, pair.person1.gender,
        pair.person2.name, pair.person2.gender
      );
      
      lines.push(`${index + 1}. ${p1}\n    💕\n    ${p2}\n    💯 ${percent}% - ${message}`);
    } else {
      const p1 = `${pair.person1.gender || ""} ${pair.person1.name}`.trim();
      lines.push(`${index + 1}. 🙋 ${p1} (Solo - waiting for the one! 💭)`);
    }
  }

  let header = "💘 AI Love Matching\n";
  header += "🤖 Powered by Gemini AI\n";
  
  if (stats) {
    header += `\n📊 ${stats.males}♂️ males • ${stats.females}♀️ females`;
    if (stats.unknown > 0) {
      header += ` • ${stats.unknown}❓ unknown`;
    }
    if (stats.maleFemaleMatches !== undefined && stats.maleFemaleMatches > 0) {
      header += `\n💑 Perfect M×F matches: ${stats.maleFemaleMatches}`;
    }
    header += "\n";
  }

  return `${header}\n${lines.join("\n\n")}`;
}

module.exports = {
  generateRandomPairs,
  formatPairsMessage,
  analyzeGenders,
  analyzeLoveCompatibility,
};
