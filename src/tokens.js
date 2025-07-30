Mila.Modulo({
  define:"Peque.Tokens",
  usa:"$milascript/ast",
  necesita:["pequescript","$milascript/base"]
});

// Átomos

Peque.Tokens.texto = function(texto) { // Token texto: una palabra
  return Mila.AST.nuevoToken("Texto", texto);
};

Peque.Tokens.salto = function() { // Token salto
  return Mila.AST.nuevoToken("Salto");
};

Peque.Tokens.indentarMás = function() { // Token indentar +
  return Mila.AST.nuevoToken("Indentación+");
};

Peque.Tokens.indentarMenos = function() { // Token indentar -
  return Mila.AST.nuevoToken("Indentación-");
};

// Temporales

Peque.Tokens.atómico = function(token, textoOriginal=Mila.Nada) { // Token atómico: un token elemental
  return Mila.AST.nuevoNodo({
    tipoNodo: "Atómico",
    campos: {token},
    textoOriginal: textoOriginal.esNada() ? token.contenido : textoOriginal
  });
};

Peque.Tokens.línea = function(texto, indentación) { // Token línea: una línea completa
  return Mila.AST.nuevoNodo({
    tipoNodo: "Línea",
    campos: {texto, indentación},
    textoOriginal: texto
  });
};

Peque.Tokens.nodoIdentificador = function(tokens) { // Identificador no (necesariamente) atómico (puede incluir varios tokens)
  let identificador = tokens.map(x => x.textoOriginal).join(" ");
  return Mila.AST.nuevoNodo({
    tipoNodo: "Identificador",
    campos: {identificador},
    hijos: {tokens},
    textoOriginal: identificador
  });
};

Peque.Tokens.grupo = function(clase, contenido) { // Token grupo: un token que representa un agrupamiento de tokens
  return Mila.AST.nuevoNodo({
    tipoNodo: "Grupo",
    campos: {clase},
    hijos: {contenido},
    textoOriginal: contenido.map(x => x.textoOriginal).join(" ")
  });
};

// Para expresiones regulares

Peque.Tokens.disyunción = function(opciones) { // Token pipe (A|B)
  return Mila.AST.nuevaRegEx("Pipe", {
    hijos: {opciones}
  });
};

Peque.Tokens.opcional = function(nodo) { // Token opcional (A?)
  return Mila.AST.nuevaRegEx("Opcional", {
    hijos: {nodo}
  });
};

Peque.Tokens.kleene = function(nodo) { // Token cíclico (A*)
  return Mila.AST.nuevaRegEx("Estrella", {
    hijos: {nodo}
  });
};

Peque.Tokens.secuencia = function(contenido) { // Secuencia de tokens
  return Mila.AST.nuevaRegEx("Secuencia", {
    hijos: {contenido}
  });
};

// Los siguientes son tipo Mila.AST.Token porque en las producciones los uso como si fueran atómicos

Peque.Tokens.agrupado = function(clase) { // Token agrupado
  return Mila.AST.nuevoToken("Grupo", clase);
};

Peque.Tokens.recursivo = function(clase) { // No terminal genérico
  return Mila.AST.nuevoToken("Recursivo", clase);
};

// Identificador (para recuperar una secuencia de tokens como un identificador único)

Peque.Tokens.tokenIdentificador = function() {
  return Mila.AST.nuevoToken("Identificador");
};