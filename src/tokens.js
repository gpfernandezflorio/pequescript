Mila.Modulo({
  define:"Peque.Tokens",
  usa:"$milascript/ast",
  necesita:["pequescript","$milascript/base"]
});

// Átomos

Peque.Tokens.texto = function(texto) { // Token texto: una palabra
  return Mila.AST.nuevoNodo({
    tipoNodo: "Texto",
    campos: {texto}
  });
};

Peque.Tokens.línea = function(texto, indentación) { // Token línea: una línea completa
  return Mila.AST.nuevoNodo({
    tipoNodo: "Línea",
    campos: {texto, indentación}
  });
};

Peque.Tokens.salto = function() { // Token salto
  return Mila.AST.nuevoNodo({
    tipoNodo: "Salto"
  });
};

Peque.Tokens.indentarMás = function() { // Token indentar +
  return Mila.AST.nuevoNodo({
    tipoNodo: "Indentación+"
  });
};

Peque.Tokens.indentarMenos = function() { // Token indentar -
  return Mila.AST.nuevoNodo({
    tipoNodo: "Indentación-"
  });
};

Peque.Tokens.número = function(n=0) { // Token numérico
  return Mila.AST.nuevoNodo({
    tipoNodo: "Número",
    campos: {n},
  });
};

// Para expresiones regulares

Peque.Tokens.disyunción = function(opciones) { // Token pipe (A|B)
  return Mila.AST.nuevoNodo({
    tipoNodo: "Pipe",
    hijos: {opciones}
  });
};

Peque.Tokens.opcional = function(nodo) { // Token opcional (A?)
  return Mila.AST.nuevoNodo({
    tipoNodo: "Opcional",
    hijos: {nodo}
  });
};

Peque.Tokens.kleene = function(nodo) { // Token cíclico (A*)
  return Mila.AST.nuevoNodo({
    tipoNodo: "Estrella",
    hijos: {nodo}
  });
};

Peque.Tokens.secuencia = function(clave, contenido=[]) { // Tokens varios
  return Mila.AST.nuevoNodo({
    tipoNodo: "Varios",
    campos: {clave},
    hijos: {contenido}
  });
};

Peque.Tokens.grupo = function(clave, contenido=[]) { // Token grupo
  return Mila.AST.nuevoNodo({
    tipoNodo: "Grupo",
    campos: {clave},
    hijos: {contenido}
  });
};