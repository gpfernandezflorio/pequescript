Mila.Modulo({
  define:"Demo",
  necesita:["pequescript","tokens","produccion","$milascript/base","$milascript/ast"],
  usa:["$milascript/pantalla/todo","parser"]
});

const tt = Peque.Tokens.texto;
const tl = Peque.Tokens.línea;
const ts = Peque.Tokens.salto;
const tiMas = Peque.Tokens.indentarMás;
const tiMenos = Peque.Tokens.indentarMenos;
const tn = Peque.Tokens.número;
const o = Peque.Tokens.disyunción;
const opt = Peque.Tokens.opcional;
const rep = Peque.Tokens.kleene;
const tv = Peque.Tokens.secuencia;
const tg = Peque.Tokens.grupo;

const P = function(tokens, nodo) {
  return Peque.Parser.Produccion.nueva({tokens, nodo});
};

Mila.alIniciar(function() {
  Mila.Tipo.NodoAST.strInstancia = Demo.strNodo_;

  Demo.parser = Peque.Parser.nuevo(Peque.Parser.nuevaConfiguración(Demo.configuración));

  Demo.textoInicial = "Procedimiento probar algo {\n  Si no ( no hay nada ) y pasa algo {\n    hacer una\n      cosa\n      maravillosa\n  } Si no {\n    hacer otra\n    cosa\n  }\n}\nProcedimiento otra cosa {\n  Repetir 3 {\n    no hacer ( nada\n    de nada )\n  }\n}";
  // Demo.textoInicial = "Procedimiento probar algo :\n  Si no ( no hay nada ) y pasa algo :\n    hacer una\n      cosa\n  Si no :\n    hacer otra\n    cosa\nProcedimiento otra cosa :\n  Repetir 3 :\n    no hacer nada";

  Demo.areaTexto = Mila.Pantalla.nuevaAreaTexto({texto:Demo.textoInicial});
  Demo.areaSalida = Mila.Pantalla.nuevaAreaTexto();
  Demo.escritorio = Mila.Pantalla.nuevoPanel({elementos:[Demo.areaTexto,Demo.areaSalida], disposicion: "Horizontal"});
  Demo.botonParsear = Mila.Pantalla.nuevoBoton({texto:"Parsear", funcion:Demo.Parsear});
  Demo.menuSuperior = Mila.Pantalla.nuevoPanel({disposicion:"Horizontal",alto:"Minimizar",elementos:[
    Demo.botonParsear
  ]});
  Mila.Pantalla.nueva({elementos:[Demo.menuSuperior,Demo.escritorio]});
});

Demo.configuración = {
  tamañoDeTab: 2,
  finesDeLínea: [
    "saltoSalvoQueIndente",
    "puntoYComa"
  ],
  agrupadores: {
    COMANDO: [
      "llavesConSalto",
      "dosPuntosConIndentación"
    ],
    EXPRESIÓN: "paréntesis",
    IGNORAR: ["indentación"]
  },
  producciones: {
    EXPRESIÓN: [
      P(tg("EXPRESIÓN"),function(tokens) {
        return Peque.Parser.nodoExpresión(tokens[0].contenido());
      }),
      P(tn(),function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "LiteralNúmero",
          campos: {valor:tokens[0].n()}
        });
      }),
      P(o([tt("cierto"),tt("falso")]),function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "LiteralBooleano",
          campos: {valor:tokens[0].texto()}
        });
      }),
      P([tv("EXPRESIÓN"),tt("y"),tv("EXPRESIÓN")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "OperaciónBinariaLógica",
          campos: {clase:"Conjunción"},
          hijos: {izquierdo:tokens[0],derecho:tokens[2]}
        });
      }),
      P([tv("EXPRESIÓN"),tt("o"),tv("EXPRESIÓN")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "OperaciónBinariaLógica",
          campos: {clase:"Disyunción"},
          hijos: {izquierdo:tokens[0],derecho:tokens[2]}
        });
      }),
      P([tv("EXPRESIÓN"),o([
        tt("+"),
        tt("-"),
        tt("."),
        tt("%"),
        tt("^")
      ]),tv("EXPRESIÓN")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "OperaciónBinariaAritmética",
          campos: {clase:tokens[1].texto()},
          hijos: {izquierdo:tokens[0],derecho:tokens[2]}
        });
      }),
      P([tt("es"),tv("EXPRESIÓN"),o([
        tt("mayor"),
        tt("menor"),
        tt(">="),
        tt("<="),
        tt("igual"),
        tt("distinto")
      ]),tt("a"),tv("EXPRESIÓN")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "OperaciónBinariaComparación",
          campos: {clase:tokens[2].texto()},
          hijos: {izquierdo:tokens[1],derecho:tokens[4]}
        });
      }),
      P([tt("no"),tv("EXPRESIÓN")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "NegaciónLógica",
          hijos: {operando:tokens[1]}
        });
      }),
      P(tv("IDENTIFICADOR"),function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "Identificador",
          campos: {identificador: tokens.map(Peque.Parser.textoOriginal).join(" ")}
        });
      })
    ],
    COMANDO: [
      P([tt("Si"),tv("EXPRESIÓN"),tg("COMANDO"),opt(ts()),tt("Si"),tt("no"),tg("COMANDO")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "AlternativaCondicionalCompuesta",
          hijos: {condición:tokens[1], ramaPositiva:tokens[2], ramaNegativa:tokens[5]}
        });
      }),
      P([tt("Si"),tv("EXPRESIÓN"),tg("COMANDO")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "AlternativaCondicionalSimple",
          hijos: {condición:tokens[1], ramaPositiva:tokens[2]}
        });
      }),
      P([tt("Repetir"),tv("EXPRESIÓN"),tg("COMANDO")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "RepeticiónSimple",
          hijos: {cantidad:tokens[1], cuerpo:tokens[2]}
        });
      }),
      P([o([tt("Mientras"),tt("Hasta")]),tv("EXPRESIÓN"),tg("COMANDO")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "RepeticiónCondicional",
          campos: {clase: tokens[0].texto()},
          hijos: {condición:tokens[1], cuerpo:tokens[2]}
        });
      }),
      P(tv("IDENTIFICADOR"),function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "Identificador",
          campos: {identificador: tokens.map(Peque.Parser.textoOriginal).join(" ")}
        });
      })
    ],
    DEFINICION: [
      P([tt("Procedimiento"),tv("IDENTIFICADOR"),tg("COMANDO")],function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "DefiniciónProcedimiento",
          hijos: {nombre:tokens[1], cuerpo:tokens[2]}
        });
      })
    ]
  }
};

Demo.Parsear = function() {
  const textoOriginal = Demo.areaTexto.texto();
  const nodos = Demo.parser.parsear(textoOriginal);
  Demo.areaSalida.CambiarTextoA_(nodos.aTexto());
  Demo.AST = nodos;
};

const s = function(k) {
  let resultado = "";
  for (let i=0; i<k; i++) {
    resultado += "  ";
  }
  return resultado;
};

Demo.strNodo_ = function(nodo) {
  switch (nodo.tipoNodo) {
    case "Texto":
      return `\n${s(nodo.nivel)}${nodo.texto()}`;
    case "Línea":
      return `\n${s(nodo.nivel)}${nodo.texto()}`;
    case "Salto":
      return `\n${s(nodo.nivel)}S`;
    case "Indentación+":
      return `\n${s(nodo.nivel)}I+`;
    case "Indentación-":
      return `\n${s(nodo.nivel)}I-`;
    case "Grupo":
      return `\n${s(nodo.nivel)}${nodo.clave()}${nodo.contenido().map(Demo.strNodo_)}`;
    case "Varios":
      return `\n${s(nodo.nivel)}${nodo.clave()} ${nodo.contenido().map(Peque.Parser.textoOriginal).join(" ")}`;
    // Nodos del programa
    case "DefiniciónProcedimiento":
      return `\n${s(nodo.nivel)}Procedimiento\n${s(nodo.nivel)}-Nombre:${Demo.strNodo_(nodo.nombre())}\n${s(nodo.nivel)}-Cuerpo:${Demo.strNodo_(nodo.cuerpo())}`;
    case "COMANDO":
      return `${nodo.contenido().map(Demo.strNodo_)}`;
    case "EXPRESIÓN":
      return `${nodo.contenido().map(Demo.strNodo_)}`;
    case "AlternativaCondicionalCompuesta":
      return `\n${s(nodo.nivel)}Alternativa Condicional Compuesta\n${s(nodo.nivel)}-Condición:${Demo.strNodo_(nodo.condición())}\n${s(nodo.nivel)}-Rama Positiva:${Demo.strNodo_(nodo.ramaPositiva())}\n${s(nodo.nivel)}-Rama Negativa:${Demo.strNodo_(nodo.ramaNegativa())}`;
    case "AlternativaCondicionalSimple":
      return `\n${s(nodo.nivel)}Alternativa Condicional Simple\n${s(nodo.nivel)}-Condición:${Demo.strNodo_(nodo.condición())}\n${s(nodo.nivel)}-Rama Positiva:${Demo.strNodo_(nodo.ramaPositiva())}`;
    case "RepeticiónSimple":
      return `\n${s(nodo.nivel)}Repetición Simple\n${s(nodo.nivel)}-Cantidad:${Demo.strNodo_(nodo.cantidad())}\n${s(nodo.nivel)}-Cuerpo:${Demo.strNodo_(nodo.cuerpo())}`;
    case "RepeticiónCondicional":
      return `\n${s(nodo.nivel)}Repetición Condicional (${nodo.clase()})\n${s(nodo.nivel)}-Condición:${Demo.strNodo_(nodo.condición())}\n${s(nodo.nivel)}-Cuerpo:${Demo.strNodo_(nodo.cuerpo())}`;
    case "NegaciónLógica":
      return `\n${s(nodo.nivel)}Negación${Demo.strNodo_(nodo.operando())}`;
    case "OperaciónBinariaLógica":
      return `\n${s(nodo.nivel)}${nodo.clase()}${Demo.strNodo_(nodo.izquierdo())}${Demo.strNodo_(nodo.derecho())}`;
    case "OperaciónBinariaAritmética":
      return `\n${s(nodo.nivel)}${nodo.clase()}${Demo.strNodo_(nodo.izquierdo())}${Demo.strNodo_(nodo.derecho())}`;
    case "OperaciónBinariaComparación":
      return `\n${s(nodo.nivel)}${nodo.clase()}${Demo.strNodo_(nodo.izquierdo())}${Demo.strNodo_(nodo.derecho())}`;
    case "Identificador":
      return `\n${s(nodo.nivel)}${nodo.identificador()}`;
    case "LiteralNúmero":
      return `\n${s(nodo.nivel)}Número ${nodo.valor()}`;
    case "LiteralBooleano":
      return `\n${s(nodo.nivel)}Booleano ${nodo.valor()}`;
  }
  return "";
};