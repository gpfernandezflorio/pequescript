Mila.Modulo({
  define:"Demo",
  necesita:["pequescript","$milascript/base","$milascript/ast"],
  usa:["$milascript/pantalla/todo"]
});

const tt = function(texto) { // Token texto
  return Mila.AST.nuevoNodo({
    tipoNodo: "Texto",
    campos: {texto}
  });
};

const tl = function(texto, indentación) { // Token línea
  return Mila.AST.nuevoNodo({
    tipoNodo: "Línea",
    campos: {texto, indentación}
  });
};

const ts = function() { // Token salto
  return Mila.AST.nuevoNodo({
    tipoNodo: "Salto"
  });
};

const tiMas = function() { // Token indentar +
  return Mila.AST.nuevoNodo({
    tipoNodo: "Indentación+"
  });
};

const tiMenos = function() { // Token indentar -
  return Mila.AST.nuevoNodo({
    tipoNodo: "Indentación-"
  });
};

const tg = function(clave, contenido=[]) { // Token grupo
  return Mila.AST.nuevoNodo({
    tipoNodo: "Grupo",
    campos: {clave},
    hijos: {contenido}
  });
};

const tv = function(clave, contenido=[]) { // Tokens varios
  return Mila.AST.nuevoNodo({
    tipoNodo: "Varios",
    campos: {clave},
    hijos: {contenido}
  });
};

const tn = function(n=0) { // Token numérico
  return Mila.AST.nuevoNodo({
    tipoNodo: "Número",
    campos: {n},
  });
};

Mila.alIniciar(function() {
  Mila.Tipo.NodoAST.strInstancia = Demo.strNodo_;
  Demo.ignorables = [];
  Demo.separadores = [];
  let finesDeLínea = Demo.configuracion.finDeLínea;
  if (!finesDeLínea.esUnaLista()) {
    finesDeLínea = [finesDeLínea];
  }
  for (let salto of finesDeLínea) {
    let separador = salto.si;
    if (!separador.esUnaLista()) {
      separador = [separador];
    }
    Demo.separadores.push(separador);
    let ignorar = salto.no;
    if (!ignorar.esUnaLista()) {
      ignorar = [ignorar];
    }
    Demo.ignorables.push(ignorar);
  }

  Demo.textoInicial = "Procedimiento probar algo {\n  Si no ( no hay nada ) y pasa algo {\n    hacer una\n      cosa\n  } Si no {\n    hacer otra\n    cosa\n  }\n}\nProcedimiento otra cosa {\n  Repetir 3 {\n    no hacer nada\n  }\n}";
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

Demo.configuracion = {
  tamañoDeTab: 2,
  agrupadores: {
    COMANDO: [
      {abre:[tt("{"),ts()], cierra:[tt("}")]}
      ,
      {abre:function(tokens, i) {
        if (Demo.coincideTokensDesde([tt(":"),ts(),tiMas()], tokens, i)) {
          let k = 3;
          while (i+k < tokens.length && Demo.coincideToken(tiMas(), tokens[i+k])) {
            k++;
          }
          return {cantidad:k, aumentoIndentación:k-2};
        }
        return Mila.Nada;
      }, cierra:function(apertura, tokens, i) {
        let k=0;
        while (
          k<apertura.aumentoIndentación &&
          i+k < tokens.length &&
          Demo.coincideToken(tiMenos(), tokens[i+k])
        ) {
          k++;
        }
        return k < apertura.aumentoIndentación ? Mila.Nada : {cantidad:k, agregar:ts()}
      }, cierraAlFinal:true}
    ],
    EXPRESIÓN: [{abre:[tt("(")], cierra:[tt(")")]}],
    IGNORAR: [{abre:[tiMas()], cierra:[tiMenos()]}],
  },
  finDeLínea: [{si:ts(),no:[ts(),tiMas()]}],
  keywords: {
    EXPRESIÓN: [
      {tokens:tg("EXPRESIÓN"),nodo:function(tokens) {
        return Demo.nodoExpresión(tokens[0].contenido());
      }},
      {tokens:tn(),nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "LiteralNúmero",
          campos: {valor:tokens[0].n()}
        });
      }},
      {tokens:[tv("EXPRESIÓN"),tt("y"),tv("EXPRESIÓN")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "OperaciónBinariaLógica",
          campos: {clase:"Conjunción"},
          hijos: {izquierdo:tokens[0],derecho:tokens[2]}
        });
      }},
      {tokens:[tv("EXPRESIÓN"),tt("o"),tv("EXPRESIÓN")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "OperaciónBinariaLógica",
          campos: {clase:"Disyunción"},
          hijos: {izquierdo:tokens[0],derecho:tokens[2]}
        });
      }},
      {tokens:[tt("no"),tv("EXPRESIÓN")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "NegaciónLógica",
          hijos: {operando:tokens[1]}
        });
      }},
      {tokens:tv("IDENTIFICADOR"),nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "Identificador",
          campos: {identificador: tokens.map(Demo.textoOriginal).join(" ")}
        });
      }}
    ],
    COMANDO: [
      {tokens:[tt("Si"),tv("EXPRESIÓN"),tg("COMANDO"),tt("Si"),tt("no"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "AlternativaCondicionalCompuesta",
          hijos: {condición:tokens[1], ramaPositiva:tokens[2], ramaNegativa:tokens[5]}
        });
      }},
      {tokens:[tt("Si"),tv("EXPRESIÓN"),tg("COMANDO"),ts(),tt("Si"),tt("no"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "AlternativaCondicionalCompuesta",
          hijos: {condición:tokens[1], ramaPositiva:tokens[2], ramaNegativa:tokens[5]}
        });
      }},
      {tokens:[tt("Si"),tv("EXPRESIÓN"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "AlternativaCondicionalSimple",
          hijos: {condición:tokens[1], ramaPositiva:tokens[2]}
        });
      }},
      {tokens:[tt("Repetir"),tv("EXPRESIÓN"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "RepeticiónSimple",
          hijos: {cantidad:tokens[1], cuerpo:tokens[2]}
        });
      }},
      {tokens:[tt("Mientras"),tv("EXPRESIÓN"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "RepeticiónCondicional",
          campos: {clase: "Mientras"},
          hijos: {condición:tokens[1], cuerpo:tokens[2]}
        });
      }},
      {tokens:[tt("Hasta"),tv("EXPRESIÓN"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "RepeticiónCondicional",
          campos: {clase: "Hasta"},
          hijos: {condición:tokens[1], cuerpo:tokens[2]}
        });
      }},
      {tokens:tv("IDENTIFICADOR"),nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "Identificador",
          campos: {identificador: tokens.map(Demo.textoOriginal).join(" ")}
        });
      }}
    ],
    DEFINICION: [
      {tokens:[tt("Procedimiento"),tv("IDENTIFICADOR"),tg("COMANDO")],nodo:function(tokens) {
        return Mila.AST.nuevoNodo({
          tipoNodo: "DefiniciónProcedimiento",
          hijos: {nombre:tokens[1], cuerpo:tokens[2]}
        });
      }}
    ]
  }
};

Demo.Parsear = function() {
  const textoOriginal = Demo.areaTexto.texto();
  // 0: reemplazar tabs por espacios
  let textoSinTabs = [];
  for (let línea of textoOriginal.split("\n")) {
    let nuevaLínea = "";
    let líneaRestante = línea;
    let iTab = líneaRestante.indexOf("\t");
    // TODO
    // while (iTab >= 0) {

    // }
    nuevaLínea += líneaRestante;
    textoSinTabs.push(nuevaLínea);
  }
  // 1: tokenizador líneas
  let tokensLínea = textoSinTabs.transformados(Demo.tokenLínea);
  let primerToken = tokensLínea.primero();
  let tokensNivel1 = [primerToken];
  let indentaciónAnterior = primerToken.indentación();
  for (let token of tokensLínea.sinElPrimero()) {
    tokensNivel1.push(ts());
    let nuevaIndentación = token.indentación();
    if (nuevaIndentación > indentaciónAnterior) {
      for (let i=0; i<nuevaIndentación-indentaciónAnterior; i++) {
        tokensNivel1.push(tiMas());
      }
    } else if (nuevaIndentación < indentaciónAnterior) {
      for (let i=0; i<indentaciónAnterior-nuevaIndentación; i++) {
        tokensNivel1.push(tiMenos());
      }
    }
    tokensNivel1.push(token);
    indentaciónAnterior = nuevaIndentación;
  }
  // 2: tokenizador de línea
  let tokensNivel2 = [];
  for (let token of tokensNivel1) {
    if (token.tipoNodo == "Línea") {
      for (let token2 of Demo.tokenLíneaATokensTexto(token)) {
        tokensNivel2.push(token2);
      }
    } else {
      tokensNivel2.push(token);
    }
  }
  const iniciadores = [];
  for (let claveAgrupador in Demo.configuracion.agrupadores) {
    let lista = Demo.configuracion.agrupadores[claveAgrupador];
    if (!lista.esUnaLista()) {
      lista = [lista];
    }
    for (let agrupador of lista) {
      let abre = agrupador.abre;
      if (!abre.esUnaLista() && !abre.esUnaFuncion()) {
        abre = [abre];
      }
      iniciadores.push({
        claveAgrupador,
        abre,
        cierra:agrupador.cierra,
        cierraAlFinal: 'cierraAlFinal' in agrupador ? agrupador.cierraAlFinal : false
      });
    }
  }
  let tokensAgrupados = [];
  let grupos = [];
  let i=0;
  while (i < tokensNivel2.length) {
    let proximosTokens = [];
    let grupo = Demo.grupoQueInicia(tokensNivel2, i, iniciadores);
    if (grupo.esAlgo()) {
      let cierra = grupo.cierra;
      if (!cierra.esUnaLista() && !cierra.esUnaFuncion()) {
        cierra = [cierra];
      }
      grupos.push(Object.assign({}, grupo, {
        contenido:[],
        cierra,
        apertura:tokensNivel2.subListaEntre_Y_(i+1, i+grupo.abre.cantidad)
      }));
      i+=grupo.abre.cantidad;
    } else {
      if (grupos.length > 0) {
        let clausura = Demo.cierraGrupo(tokensNivel2, i, grupos.ultimo());
        if (clausura.esAlgo()) {
          let grupo = grupos.ultimo();
          grupos.SacarUltimo();
          grupo.clausura = tokensNivel2.subListaEntre_Y_(i+1, i+clausura.cantidad);
          if (grupo.claveAgrupador == "IGNORAR") {
            proximosTokens = Demo.contenidoGrupoIgnorado(grupo);
          } else {
            proximosTokens.push(tg(grupo.claveAgrupador, grupo.contenido));
          }
          if ('agregar' in clausura) {
            for (let nodo of (clausura.agregar.esUnaLista() ? clausura.agregar : [clausura.agregar])) {
              proximosTokens.push(nodo);
            }
          }
          i+=clausura.cantidad;
        } else {
          proximosTokens.push(tokensNivel2[i]);
          i++;
        }
      } else {
        proximosTokens.push(tokensNivel2[i]);
        i++;
      }
    }
    for (let token of proximosTokens) {
      (grupos.length > 0 ? grupos.ultimo().contenido : tokensAgrupados).push(token);
    }
  }
  // Cerrar los grupos que se cierran al final del archivo
  while (!grupos.esVacia() && grupos.ultimo().cierraAlFinal) {
    let grupo = grupos.ultimo();
    grupos.SacarUltimo();
    (grupos.length > 0 ? grupos.ultimo().contenido : tokensAgrupados)
      .push(tg(grupo.claveAgrupador, grupo.contenido))
    ;
  }
  if (!grupos.esVacia()) {
    // Error
    return;
  }
  // 3: parsing top-down
  let tokensLimpios = Demo.filtroIgnorables(tokensAgrupados);
  const nodos = [];
  const líneas = Demo.líneasDeTokens(tokensLimpios);
  i=0;
  while (i.esAlgo() && i<líneas.length) {
    i = Demo.AgregarNodos(nodos, líneas, i, "DEFINICION");
  }
  Demo.areaSalida.CambiarTextoA_(nodos.aTexto());
  Demo.AST = nodos;
};

Demo.coincideToken = function(token1, token2) {
  if (token1.tipoNodo == token2.tipoNodo) {
    switch (token1.tipoNodo) {
      case "Texto":
        return token1.texto() == token2.texto();
      case "Grupo":
        return token1.clave() == token2.clave();
      case "Varios":
        return token1.clave() == token2.clave();
    }
    return true;
  }
  return false;
};

Demo.coincideTokensDesde = function(tokens1, tokens2, desde) {
  let i=0;
  while (i<tokens1.length && Demo.coincideToken(tokens1[i], tokens2[desde+i])) {
    i++;
  }
  return i == tokens1.length;
};

Demo.grupoQueInicia = function(tokens, i, iniciadores) {
  let apertura = Mila.Nada;
  for (let grupo of iniciadores) {
    if (
      grupo.abre.esUnaFuncion()
    ) {
      apertura = grupo.abre(tokens, i);
    } else if (
      grupo.abre.esUnaLista() &&
      grupo.abre.length <= tokens.length-i &&
      Demo.coincideTokensDesde(grupo.abre, tokens, i)
    ) {
      apertura = {cantidad: grupo.abre.length};
    }
    if (apertura.esAlgo()) {
      return Object.assign({}, grupo, {abre:apertura});
    }
  }
  return Mila.Nada;
};

Demo.cierraGrupo = function(tokens, i, grupo) {
  let clausura = Mila.Nada
  if (
    grupo.cierra.esUnaFuncion()
  ) {
    clausura = grupo.cierra(grupo.abre, tokens, i);
  } else if (
    grupo.cierra.esUnaLista() &&
    grupo.cierra.length <= tokens.length-i
  ) {
    if (Demo.coincideTokensDesde(grupo.cierra, tokens, i)) {
      clausura = {cantidad:grupo.cierra.length};
    }
  }
  return clausura;
};

Demo.contenidoGrupoIgnorado = function(grupo) {
  return grupo.apertura.concatenadaCon_(grupo.contenido).concatenadaCon_(grupo.clausura);
};

Demo.filtroIgnorables = function(tokens) {
  let tokensLimpios = [];
  let i=0;
  while (i<tokens.length) {
    let token = tokens[i];
    if (token.tipoNodo == "Grupo") {
      token.CambiarHijo_A_('contenido', Demo.filtroIgnorables(token.contenido()));
      tokensLimpios.push(token);
      i++;
    } else if (token.tipoNodo == "Texto" && token.texto().length == 0) {
      i++;
    } else {
      let tokensAIgnorar = Demo.tokensIgnorables(tokens, i);
      if (tokensAIgnorar > 0) {
        i+=tokensAIgnorar;
      } else {
        if (token.tipoNodo != "Indentación+" && token.tipoNodo != "Indentación-") {
          tokensLimpios.push(token);
        }
        i++;
      }
    }
  }
  return tokensLimpios;
}

Demo.tokensIgnorables = function(tokens, i) {
  for (let ignorable of Demo.ignorables) {
    if (
      ignorable.length <= tokens.length-i &&
      Demo.coincideTokensDesde(ignorable, tokens, i)
    ) {
      return ignorable.length;
    }
  }
  return 0;
};

Demo.líneasDeTokens = function(tokens) {
  const líneas = [];
  let líneaActual = [];
  let i=0;
  while(i<tokens.length) {
    let proximoSeparador = Demo.proximoSeparador(tokens, i);
    if (proximoSeparador > 0) {
      líneas.push(líneaActual);
      líneaActual = [];
      i+=proximoSeparador;
    } else {
      líneaActual.push(tokens[i]);
      i++;
    }
  }
  if (líneaActual.length > 0) {
    líneas.push(líneaActual);
  }
  return líneas;
};

Demo.proximoSeparador = function(tokens, i) {
  for (let separador of Demo.separadores) {
    if (
      separador.length <= tokens.length-i &&
      Demo.coincideTokensDesde(separador, tokens, i)
    ) {
      return separador.length;
    }
  }
  return 0;
};

Demo.AgregarNodos = function(nodos, líneas, i, contexto) {
  for (let construccion of Demo.configuracion.keywords[contexto]) {
    let líneaAjustada = Demo.línea_AjustadaA_(líneas, i, construccion);
    if (líneaAjustada.esAlgo()) {
      nodos.push(construccion.nodo(líneaAjustada.línea));
      return líneaAjustada.i;
    }
  }
  return Mila.Nada;
};

Demo.línea_AjustadaA_ = function(líneas, inicio, construccion) {
  let línea = líneas[inicio];
  let i=0;
  let j=0;
  let resultado = {i:inicio+1, línea:[]};
  let tokens = construccion.tokens;
  if (!tokens.esUnaLista()) {
    tokens = [tokens];
  }
  while(i<tokens.length) {
    let proximo = tokens[i];
    if (j >= línea.length && proximo.tipoNodo != "Salto") {
      return Mila.Nada;
    }
    if (proximo.tipoNodo == "Salto") {
      if (líneas.length < resultado.i) {
        return Mila.Nada;
      }
      línea = líneas[resultado.i];
      resultado.i++;
      i++;
      j=0;
    } else if (proximo.tipoNodo == "Varios") {
      if (i==tokens.length-1) {
        let contenido = línea.sinLosPrimeros_(j);
        if (Demo.seAjustaVarios(contenido, proximo.clave())) {
          resultado.línea.push(Demo.nodoVarios(contenido, proximo.clave()));
          return resultado;
        } else {
          return Mila.Nada;
        }
      }
      i++;
      let proximoProximo = tokens[i];
      let varios = [línea[j]];
      j++;
      while (j < línea.length && !Demo.coincideToken(proximoProximo, línea[j])) {
        varios.push(línea[j]);
        j++;
      }
      if (j >= línea.length && proximoProximo.tipoNodo != "Salto") {
        return Mila.Nada;
      }
      if (Demo.seAjustaVarios(varios, proximo.clave())) {
        resultado.línea.push(Demo.nodoVarios(varios, proximo.clave()));
      } else {
        return Mila.Nada;
      }
      if (j < línea.length) {
        let tokenAjustado = Demo.token_AjustadoA_(línea[j], proximoProximo);
        if (tokenAjustado.esAlgo()) {
          resultado.línea.push(tokenAjustado);
        } else {
          return Mila.Nada;
        }
        i++;
        j++;
      }
    } else if (Demo.coincideToken(proximo, línea[j])) {
      let tokenAjustado = Demo.token_AjustadoA_(línea[j], proximo);
      if (tokenAjustado.esAlgo()) {
        resultado.línea.push(tokenAjustado);
      } else {
        return Mila.Nada;
      }
      i++;
      j++;
    } else {
      return Mila.Nada;
    }
  }
  if (j < línea.length) {
    return Mila.Nada;
  }
  return resultado;
};

Demo.token_AjustadoA_ = function(token, tokenConstruccion) {
  // PRE: los tokens coinciden
  if (tokenConstruccion.tipoNodo == "Grupo") {
    return Demo.nodoGrupo(token);
  } else {
    return token;
  }
};

Demo.tokenLínea = function(línea) {
  let i=0;
  while (i<línea.length && línea[i] == " ") {
    i++;
  }
  return tl(línea.substring(i), i);
};

Demo.tokenLíneaATokensTexto = function(tokenLínea) {
  let texto = tokenLínea.texto().trim();
  return texto.split(" ").transformados(texto =>
    Number.isNaN(Number.parseFloat(texto)) ? tt(texto) : tn(Number.parseFloat(texto))
  );
};

Demo.seAjustaVarios = function(variosNodos, clave) {
  return true;
};

Demo.nodoVarios = function(variosNodos, clave) {
  switch (clave) {
    case "IDENTIFICADOR":
      return Mila.AST.nuevoNodo({
        tipoNodo: "Identificador",
        campos: {identificador: variosNodos.map(Demo.textoOriginal).join(" ")}
      });
    case "EXPRESIÓN":
      const nodos = [];
      Demo.AgregarNodos(nodos, [variosNodos], 0, clave);
      return Demo.nodoExpresión(nodos);
  }
  return Mila.AST.nuevoNodo({
    tipoNodo: clave
  });
};

Demo.nodoExpresión = function(nodos) { // Debería recibir una lista con un único elemento
  if (nodos.length != 1) {
    console.log("Expresión con longitud distinta a 1");
    debugger;
    return Mila.AST.nuevoNodo({
      tipoNodo: "EXPRESIÓN",
      hijos: {contenido:nodos}
    });
  }
  return nodos[0];
}

Demo.nodoGrupo = function(nodo) {
  const nodos = [];
  const líneas = Demo.líneasDeTokens(nodo.contenido());
  let i=0;
  while (i.esAlgo() && i<líneas.length) {
    i = Demo.AgregarNodos(nodos, líneas, i, nodo.clave());
  }
  return Mila.AST.nuevoNodo({
    tipoNodo: nodo.clave(),
    hijos: {contenido: nodos}
  });
};

const s = function(k) {
  let resultado = "";
  for (let i=0; i<k; i++) {
    resultado += "  ";
  }
  return resultado;
};

Demo.textoOriginal = function (nodo) {
  switch (nodo.tipoNodo) {
    case "Texto":
      return nodo.texto();
    case "Línea":
      return nodo.texto();
    case "Salto":
      return '\\n';
    case "Indentación+":
      return `I+`;
    case "Indentación-":
      return `I-`;
    case "Grupo":
      return `${nodo.clave()} ${nodo.contenido().map(Demo.textoOriginal)}`;
    case "Varios":
      return `${nodo.contenido().map(Demo.textoOriginal).join(" ")}`;
    case "Identificador":
      return `${nodo.identificador()}`;
  }
  return "";
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
      return `\n${s(nodo.nivel)}${nodo.clave()} ${nodo.contenido().map(Demo.textoOriginal).join(" ")}`;
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
    case "Identificador":
      return `\n${s(nodo.nivel)}${nodo.identificador()}`;
    case "LiteralNúmero":
      return `\n${s(nodo.nivel)}Número ${nodo.valor()}`;
  }
  return "";
};