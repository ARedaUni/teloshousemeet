export function formatTranscriptText(text: string): string {
    // Split by speaker sections first
    const speakerSections = text.split(/\n\n(?=Speaker [AB]:)/);
  
    return speakerSections
      .map((section) => {
        // Check if this is a speaker section
        const speakerMatch = section.match(/^(Speaker [AB]):([\s\S]*)$/);
        if (!speakerMatch) return section;
  
        const speaker = speakerMatch[1];
        const content = speakerMatch[2];
        const speakerColor =
          speaker.includes('A') ? 'text-blue-500' : 'text-green-500';
  
        // Split content into sentences
        const sentences =
          content.match(/[^.!?]+[.!?]+/g) || [content.trim()];
        const paragraphs: string[] = [];
        let currentParagraph: string[] = [];
        let wordCount = 0;
  
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          const sentenceWords = trimmedSentence.split(/\s+/).length;
  
          if (wordCount + sentenceWords > 50) {
            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph.join(' '));
              currentParagraph = [];
              wordCount = 0;
            }
          }
  
          currentParagraph.push(trimmedSentence);
          wordCount += sentenceWords;
        }
  
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join(' '));
        }
  
        // Join paragraphs with double line breaks and add speaker tag
        return `<div class="mb-6">
          <span class="${speakerColor} font-semibold">${speaker}:</span>
          ${paragraphs.map((p) => `<p class="mt-2">${p}</p>`).join('\n')}
        </div>`;
      })
      .join('\n\n');
  }
  
export const formatFileName = (name) => {
    // Remove common suffixes like "transcript" or "summary"
    const cleanedName = name
      .replace(/_(transcript|summary)\.txt$/i, '') // Remove "_transcript.txt" or "_summary.txt" (case insensitive)
      .replace(/\.txt$/i, ''); // Remove any remaining ".txt"
  
    // Split the name by "|"
    const [title, date] = cleanedName.split('|');
    
    // Format the title: Replace underscores with spaces and capitalize each word
    const cleanTitle = title?.trim().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';
  
    // Format the date: Rearrange if it matches DD/MM/YYYY
    const cleanDate = date?.trim().replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3') || '';
  
    // Combine and return the formatted name
    return `${cleanTitle} | ${cleanDate}`;
  };
  