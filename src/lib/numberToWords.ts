/**
 * Convert a number to French words (Algerian format)
 * Example: 839200.00 -> "HUIT CENT TRENTE-NEUF MILLE DEUX CENTS DINARS ALGÉRIENS ET ZÉRO CENTIMES"
 */

const ones = [
  "", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF",
  "DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"
];

const tens = [
  "", "", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE-DIX", "QUATRE-VINGT", "QUATRE-VINGT-DIX"
];

function convertHundreds(num: number): string {
  let result = "";
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundreds > 0) {
    if (hundreds === 1) {
      result = "CENT";
    } else {
      result = ones[hundreds] + " CENT";
    }
    if (remainder === 0 && hundreds > 1) {
      result += "S";
    }
  }

  if (remainder > 0) {
    if (result) result += " ";
    if (remainder < 20) {
      result += ones[remainder];
    } else {
      const tensPlace = Math.floor(remainder / 10);
      const onesPlace = remainder % 10;
      
      if (tensPlace === 7) {
        // Soixante-dix, soixante-et-onze, etc.
        result += "SOIXANTE";
        if (onesPlace > 0) {
          result += "-" + ones[10 + onesPlace];
        }
      } else if (tensPlace === 9) {
        // Quatre-vingt, quatre-vingt-un, quatre-vingt-onze, etc.
        result += "QUATRE-VINGT";
        if (onesPlace > 0) {
          result += "-" + ones[10 + onesPlace];
        } else {
          result += "S";
        }
      } else {
        result += tens[tensPlace];
        if (onesPlace > 0) {
          if (tensPlace === 8 && onesPlace === 1) {
            result += "-ET-UN";
          } else if (onesPlace === 1) {
            result += " ET UN";
          } else {
            result += "-" + ones[onesPlace];
          }
        } else if (tensPlace === 8) {
          result += "S";
        }
      }
    }
  }

  return result;
}

function convertThousands(num: number): string {
  if (num === 0) return "";
  if (num < 1000) return convertHundreds(num);
  
  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  
  let result = "";
  if (thousands === 1) {
    result = "MILLE";
  } else {
    result = convertHundreds(thousands) + " MILLE";
  }
  
  if (remainder > 0) {
    result += " " + convertHundreds(remainder);
  }
  
  return result;
}

function convertMillions(num: number): string {
  if (num === 0) return "ZÉRO";
  if (num < 1000000) return convertThousands(num);
  
  const millions = Math.floor(num / 1000000);
  const remainder = num % 1000000;
  
  let result = "";
  if (millions === 1) {
    result = "UN MILLION";
  } else {
    result = convertHundreds(millions) + " MILLIONS";
  }
  
  if (remainder > 0) {
    result += " " + convertThousands(remainder);
  }
  
  return result;
}

export function numberToWords(amount: number): string {
  if (amount === 0) {
    return "ZÉRO DINARS ALGÉRIENS ET ZÉRO CENTIMES";
  }

  // Split into integer and decimal parts
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let result = convertMillions(integerPart);
  
  // Add "DINARS ALGÉRIENS"
  if (integerPart === 1) {
    result += " DINAR ALGÉRIEN";
  } else {
    result += " DINARS ALGÉRIENS";
  }

  // Add centimes with line break
  result += " \nET ";
  if (decimalPart === 0) {
    result += "ZÉRO CENTIMES";
  } else if (decimalPart === 1) {
    result += convertHundreds(decimalPart) + " CENTIME";
  } else {
    result += convertHundreds(decimalPart) + " CENTIMES";
  }

  return result;
}

