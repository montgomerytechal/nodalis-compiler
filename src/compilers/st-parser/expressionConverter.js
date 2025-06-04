
export function convertExpression(expr) {
  var results =  expr
    .replace(/\bAND\b/gi, '&&')
    .replace(/\bOR\b/gi, '||')
    .replace(/\bNOT\b/gi, '!')
    .replace(/\bMOD\b/gi, '%')
    .replace(/\bDIV\b/gi, '/')
    .replace(/<>/g, '!=')
    .replace(/:=/g, '=')
    .replace(/\bTRUE\b/gi, 'true')
    .replace(/\bFALSE\b/gi, 'false')
    .replace(/(?<![=!<>])=(?![=])/g, '=='); // '=' becomes '==' if not already comparison
    const parts = results.split(" ");
    results = "";
    parts.forEach((e) => {
        if(/^%[IQM]/i.test(e)){
            results += `readAddress("${e}") `;
        }
        else{
            results += e + " ";
        }
    });
    results = results.trim();
    return results;
}
