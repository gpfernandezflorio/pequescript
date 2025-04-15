Mila.Modulo({
  define:"Peque.Parser",
  necesita:["pequescript","$milascript/base","$milascript/ast","tokens"],
  usa:["estado","produccion"]
});

const TipoToken = Mila.Tipo.O([Mila.Tipo.NodoAST,Mila.Tipo.ListaDe_(Mila.Tipo.NodoAST)]);
const TipoSeparadorLínea = Mila.Tipo.RegistroCon_({
  "?id":Mila.Tipo.Texto,
  "tokens":TipoToken,
  "?escape":TipoToken
});
const TipoAgrupador = Mila.Tipo.RegistroCon_({
  "abre":Mila.Tipo.O([TipoToken, Mila.Tipo.Funcion]), // Si es una función toma la lista de tokens y el índice i
    // y devuelve un objeto con, al menos, el campo "cantidad" (la cantidad de tokens que matcheó) si matchea
    // o Mila.Nada si no.
  "cierra":Mila.Tipo.O([TipoToken, Mila.Tipo.Funcion]), // Si es una función toma el objeto que devolvió "abre",
    // la lista de tokens y el índice i y devuelve un objeto con el campo "cantidad" (la cantidad de tokens
    // que matcheó) y, opcionalmente, el campo "agregar" (un token o una lista de tokens a agregar tras el match)
    // si matchea o Mila.Nada si no.
  "?cierraAlFinal":Mila.Tipo.Booleano
});

Mila.Tipo.Registrar({
  nombre:'AtributosParserPeque',
  es: {
    "?tamañoDeTab":Mila.Tipo.Entero,
    "?finesDeLínea":Mila.Tipo.O([TipoSeparadorLínea, Mila.Tipo.ListaDe_(TipoSeparadorLínea)]),
    "?agrupadores":Mila.Tipo.Registro, // las claves son TipoAgrupador o lista de TipoAgrupador
    "?producciones":Mila.Tipo.Registro // las claves son ProduccionParserPeque o lista de ProduccionParserPeque
  },
  inferible: false
});

Mila.Tipo.Registrar({
  nombre:'AtributosParseoPeque',
  es: {
    "tamañoDeTab":Mila.Tipo.Entero
  },
  inferible: false
});

Mila.Tipo.Registrar({
  nombre:'ResultadoParserPeque',
  es: {
    // Resultado (ok o error) + AST (sólo si no falló)
  },
  inferible: false
});

Peque.Parser.atributosPorDefecto = {
  tamañoDeTab:2,
  finesDeLínea:{
    tokens:Peque.Tokens.salto(),
    escape:[Peque.Tokens.salto(),Peque.Tokens.indentarMás]
  },
  agrupadores:{},
  producciones:{}
};

Peque.Parser.nuevo = function(atributos=Peque.Parser.atributosPorDefecto) {
  Mila.Contrato({
    Proposito: [
      "Describir un nuevo parser de Pequescript configurado a partir de los atributos dados",
      Mila.Tipo.ParserPeque
    ],
    Parametros: [
      [atributos, Mila.Tipo.AtributosParserPeque]
    ]
  });
  const nuevo = new Peque.Parser._Parser();
  nuevo.CambiarTamañoTabA_('tamañoDeTab' in atributos
    ? atributos.tamañoDeTab
    : Peque.Parser.atributosPorDefecto.tamañoDeTab
  );
  nuevo.CambiarSeparadoresDeLíneaA_('finesDeLínea' in atributos
    ? atributos.finesDeLínea
    : Peque.Parser.atributosPorDefecto.finesDeLínea
  );
  nuevo.CambiarAgrupadoresA_('agrupadores' in atributos
    ? atributos.agrupadores
    : Peque.Parser.atributosPorDefecto.agrupadores
  );
  nuevo.CambiarProduccionesA_('producciones' in atributos
    ? atributos.producciones
    : Peque.Parser.atributosPorDefecto.producciones
  );
  return nuevo;
};

Peque.Parser._Parser = function ParserPeque() {};

Mila.Tipo.Registrar({
  nombre: "ParserPeque",
  prototipo: Peque.Parser._Parser
});

Peque.Parser._Parser.prototype.parsear = function(entrada, atributos={}) {
  Mila.Contrato({
    Proposito: [
      "Describir el resultado de parsear la cadena con este parser",
      Mila.Tipo.ResultadoParserPeque
    ],
    Parametros: [
      [entrada, Mila.Tipo.Texto]
      [atributos, Mila.Tipo.AtributosParseoPeque]
    ]
  });
  this.estado = Peque.Parser.Estado.nuevo(entrada, {
    tamañoDeTab: 'tamañoDeTab' in atributos ? atributos.tamañoDeTab : this.tamañoDeTab
  });
  this._ReemplazarTabsPorEspacios();
  this._AgregarTokensEntreLíneas();
  this._TokenizarLíneas();
  this._AgruparTokens();
  this._ParsearTokens();
  return this.estado.cadena();
};

Peque.Parser._Parser.prototype._ReemplazarTabsPorEspacios = function() {
  let textoSinTabs = [];
  for (let línea of this.estado.cadena().split("\n")) {
    let nuevaLínea = "";
    let líneaRestante = línea;
    let iTab = líneaRestante.indexOf("\t");
    // TODO
    // while (iTab >= 0) {

    // }
    nuevaLínea += líneaRestante;
    textoSinTabs.push(nuevaLínea);
  }
  this.estado.ActualizarCadena_(textoSinTabs);
};

Peque.Parser._Parser.prototype._AgregarTokensEntreLíneas = function() {
  let tokensLínea = this.estado.cadena().transformados(tokenLíneaTrim);
  let primerToken = tokensLínea.primero();
  let todosLosTokens = [primerToken];
  let indentaciónAnterior = primerToken.indentación();
  for (let token of tokensLínea.sinElPrimero()) {
    todosLosTokens.push(Peque.Tokens.salto());
    let nuevaIndentación = token.indentación();
    if (nuevaIndentación > indentaciónAnterior) {
      for (let i=0; i<nuevaIndentación-indentaciónAnterior; i++) {
        todosLosTokens.push(Peque.Tokens.indentarMás());
      }
    } else if (nuevaIndentación < indentaciónAnterior) {
      for (let i=0; i<indentaciónAnterior-nuevaIndentación; i++) {
        todosLosTokens.push(Peque.Tokens.indentarMenos());
      }
    }
    todosLosTokens.push(token);
    indentaciónAnterior = nuevaIndentación;
  }
  this.estado.ActualizarCadena_(todosLosTokens);
};

Peque.Parser._Parser.prototype._TokenizarLíneas = function() {
  let todosLosTokens = [];
  for (let token of this.estado.cadena()) {
    if (token.tipoNodo == "Línea") {
      todosLosTokens.ConcatenarCon_(this._TokenizarTokenLínea_(token));
    } else {
      todosLosTokens.push(token);
    }
  }
  this.estado.ActualizarCadena_(todosLosTokens);
};

Peque.Parser._Parser.prototype._TokenizarTokenLínea_ = function(tokenLínea) {
  let texto = tokenLínea.texto().trim();
  return texto.split(" ").transformados(texto =>
    Number.isNaN(Number.parseFloat(texto)) ? Peque.Tokens.texto(texto) : Peque.Tokens.número(Number.parseFloat(texto))
  );
};

Peque.Parser._Parser.prototype._AgruparTokens = function() {
  let tokensAnteriores = this.estado.cadena();
  let todosLosTokens = [];
  let grupos = [];
  let i=0;
  while (i < tokensAnteriores.length) {
    let proximosTokens = [];
    let grupo = Peque.Parser.grupoQueInicia(tokensAnteriores, i, this.iniciadores);
    if (grupo.esAlgo()) {
      grupos.push(grupo);
      i+=grupo.abre.cantidad;
    } else {
      if (grupos.length > 0) {
        let clausura = Peque.Parser.cierraGrupo(tokensAnteriores, i, grupos.ultimo());
        if (clausura.esAlgo()) {
          let grupo = grupos.ultimo();
          grupos.SacarUltimo();
          grupo.clausura = tokensAnteriores.subListaEntre_Y_(i+1, i+clausura.cantidad);
          if (grupo.claveAgrupador == "IGNORAR") {
            proximosTokens = Peque.Parser.contenidoGrupoIgnorado(grupo);
          } else {
            proximosTokens.push(Peque.Tokens.grupo(grupo.claveAgrupador, grupo.contenido));
          }
          if ('agregar' in clausura) {
            for (let nodo of (clausura.agregar.esUnaLista() ? clausura.agregar : [clausura.agregar])) {
              proximosTokens.push(nodo);
            }
          }
          i+=clausura.cantidad;
        } else {
          proximosTokens.push(tokensAnteriores[i]);
          i++;
        }
      } else {
        proximosTokens.push(tokensAnteriores[i]);
        i++;
      }
    }
    for (let token of proximosTokens) {
      (grupos.length > 0 ? grupos.ultimo().contenido : todosLosTokens).push(token);
    }
  }
  while (!grupos.esVacia() && grupos.ultimo().cierraAlFinal) {
    let grupo = grupos.ultimo();
    grupos.SacarUltimo();
    (grupos.length > 0 ? grupos.ultimo().contenido : todosLosTokens)
      .push(Peque.Tokens.grupo(grupo.claveAgrupador, grupo.contenido))
    ;
  }
  if (!grupos.esVacia()) {
    // Error
    return;
  }
  this.estado.ActualizarCadena_(todosLosTokens);
};

Peque.Parser._Parser.prototype._ParsearTokens = function() {
  let tokensLimpios = this._tokensLimpios(this.estado.cadena());
  const líneas = this._líneasDeTokens(tokensLimpios);
  const nodos = [];
  let i=0;
  while (i.esAlgo() && i<líneas.length) {
    i = this._AgregarNodos(nodos, líneas, i, "DEFINICION");
  }
  this.estado.ActualizarCadena_(nodos);
};

Peque.Parser._Parser.prototype._AgregarNodos = function(nodos, líneas, i, contexto) {
  if (contexto in this.producciones) {
    for (let construccion of this.producciones[contexto]) {
      let líneaAjustada = this._línea_AjustadaA_(líneas, i, construccion);
      if (líneaAjustada.esAlgo()) {
        nodos.push(construccion.nodo(líneaAjustada.línea));
        return líneaAjustada.i;
      }
    }
  }
  return Mila.Nada;
};

Peque.Parser.grupoQueInicia = function(tokens, i, iniciadores) {
  let apertura = Mila.Nada;
  for (let grupo of iniciadores) {
    if (
      grupo.abre.esUnaFuncion()
    ) {
      apertura = grupo.abre(tokens, i);
    } else if (
      grupo.abre.esUnaLista() &&
      grupo.abre.length <= tokens.length-i &&
      Peque.Parser.coincideTokensDesde(grupo.abre, tokens, i)
    ) {
      apertura = {cantidad: grupo.abre.length};
    }
    if (apertura.esAlgo()) {
      return Object.assign({}, grupo, {
        abre:apertura,
        contenido:[],
        apertura:tokens.subListaEntre_Y_(i+1, i+apertura.cantidad)
      });
    }
  }
  return Mila.Nada;
};

Peque.Parser.cierraGrupo = function(tokens, i, grupo) {
  let clausura = Mila.Nada
  if (
    grupo.cierra.esUnaFuncion()
  ) {
    clausura = grupo.cierra(grupo.abre, tokens, i);
  } else if (
    grupo.cierra.esUnaLista() &&
    grupo.cierra.length <= tokens.length-i
  ) {
    if (Peque.Parser.coincideTokensDesde(grupo.cierra, tokens, i)) {
      clausura = {cantidad:grupo.cierra.length};
    }
  }
  return clausura;
};

Peque.Parser.contenidoGrupoIgnorado = function(grupo) {
  return grupo.apertura.concatenadaCon_(grupo.contenido).concatenadaCon_(grupo.clausura);
};

Peque.Parser._Parser.prototype._tokensLimpios = function(tokens) {
  let tokensLimpios = [];
  let i=0;
  while (i<tokens.length) {
    let token = tokens[i];
    if (token.tipoNodo == "Grupo") {
      token.CambiarHijo_A_('contenido', this._tokensLimpios(token.contenido()));
      tokensLimpios.push(token);
      i++;
    } else if (token.tipoNodo == "Texto" && token.texto().length == 0) {
      i++;
    } else {
      let tokensAIgnorar = this._tokensIgnorables(tokens, i);
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
};

Peque.Parser._Parser.prototype._tokensIgnorables = function(tokens, i) {
  for (let ignorable of this.ignorables) {
    if (
      ignorable.length <= tokens.length-i &&
      Peque.Parser.coincideTokensDesde(ignorable, tokens, i)
    ) {
      return ignorable.length;
    }
  }
  return 0;
};

Peque.Parser.coincideToken = function(token1, token2) {
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
  switch (token1.tipoNodo) {
    case "Pipe":
      return token1.opciones().algunoCumple_(t => Peque.Parser.coincideToken(t, token2));
    case "Opcional":
      return Peque.Parser.coincideToken(token1.nodo, token2);
    case "Estrella":
      return Peque.Parser.coincideToken(token1.nodo, token2);
  }
  return false;
};

Peque.Parser.coincideTokensDesde = function(tokens1, tokens2, desde) {
  let i=0;
  while (i<tokens1.length && Peque.Parser.coincideToken(tokens2[desde+i], tokens1[i])) {
    i++;
  }
  return i == tokens1.length;
};

Peque.Parser._Parser.prototype._líneasDeTokens = function(tokens) {
  const líneas = [];
  let líneaActual = [];
  let i=0;
  while(i<tokens.length) {
    let proximoSeparador = this._proximoSeparador(tokens, i);
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

Peque.Parser._Parser.prototype._proximoSeparador = function(tokens, i) {
  for (let separador of this.separadores) {
    if (
      separador.length <= tokens.length-i &&
      Peque.Parser.coincideTokensDesde(separador, tokens, i)
    ) {
      return separador.length;
    }
  }
  return 0;
};

Peque.Parser._Parser.prototype._línea_AjustadaA_ = function(líneas, inicio, construccion) {
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
    if (j >= línea.length) {
      if (Peque.Parser.vieneUnSalto(proximo)) {
        if (líneas.length < resultado.i) {
          return Mila.Nada;
        }
        línea = líneas[resultado.i];
        resultado.i++;
        if (proximo.tipoNodo != "Estrella") {
          i++;
        }
        j=0;
      } else if (Peque.Parser.puedeTerminarAcá(tokens, i)) {
        return resultado;
      } else {
        return Mila.Nada;
      }
    } else if (proximo.tipoNodo == "Varios") {
      if (i==tokens.length-1) {
        let contenido = línea.sinLosPrimeros_(j);
        if (Peque.Parser.seAjustaVarios(contenido, proximo.clave())) {
          resultado.línea.push(this._nodoVarios(contenido, proximo.clave()));
          return resultado;
        } else {
          return Mila.Nada;
        }
      }
      i++;
      let proximoProximo = tokens[i];
      let varios = [línea[j]];
      j++;
      while (j < línea.length && !Peque.Parser.coincideToken(proximoProximo, línea[j])) {
        varios.push(línea[j]);
        j++;
      }
      if (j < línea.length) {
        if (Peque.Parser.seAjustaVarios(varios, proximo.clave())) {
          resultado.línea.push(this._nodoVarios(varios, proximo.clave()));
        } else {
          return Mila.Nada;
        }
      }
    } else if (Peque.Parser.coincideToken(proximo, línea[j])) {
      let tokenAjustado = this._token_AjustadoA_(línea[j], proximo);
      if (tokenAjustado.esAlgo()) {
        resultado.línea.push(tokenAjustado);
      } else {
        return Mila.Nada;
      }
      if (proximo.tipoNodo != "Estrella") {
        i++;
      }
      j++;
    } else if (Peque.Parser.esOpcional(proximo)) {
      i++;
    } else {
      return Mila.Nada;
    }
  }
  if (j < línea.length) {
    return Mila.Nada;
  }
  return resultado;
};

Peque.Parser._Parser.prototype._token_AjustadoA_ = function(token, tokenConstruccion) {
  // PRE: los tokens coinciden
  switch (tokenConstruccion.tipoNodo) {
    case "Grupo":
      return this._nodoGrupo(token);
  }
  return token;
};

Peque.Parser.seAjustaVarios = function(variosNodos, clave) {
  return true;
};

Peque.Parser._Parser.prototype._nodoVarios = function(variosNodos, clave) {
  switch (clave) {
    case "IDENTIFICADOR":
      return Mila.AST.nuevoNodo({
        tipoNodo: "Identificador",
        campos: {identificador: variosNodos.map(Peque.Parser.textoOriginal).join(" ")}
      });
    case "EXPRESIÓN":
      const nodos = [];
      this._AgregarNodos(nodos, [variosNodos], 0, clave);
      return Peque.Parser.nodoExpresión(nodos);
  }
  return Mila.AST.nuevoNodo({
    tipoNodo: clave
  });
};

Peque.Parser.nodoExpresión = function(nodos) { // Debería recibir una lista con un único elemento
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

Peque.Parser._Parser.prototype._nodoGrupo = function(nodo) {
  const nodos = [];
  const líneas = this._líneasDeTokens(nodo.contenido());
  let i=0;
  while (i.esAlgo() && i<líneas.length) {
    i = this._AgregarNodos(nodos, líneas, i, nodo.clave());
  }
  return Mila.AST.nuevoNodo({
    tipoNodo: nodo.clave(),
    hijos: {contenido: nodos}
  });
};

Peque.Parser.puedeTerminarAcá = function(tokens, i) {
  tokens.sinLosPrimeros_(i).todosCumplen_(Peque.Parser.esOpcional);
};

Peque.Parser.esOpcional = function(nodo) {
  return nodo.tipoNodo == "Opcional" || nodo.tipoNodo == "Estrella";
};

Peque.Parser.vieneUnSalto = function(nodo) {
  return nodo.tipoNodo == "Salto" ||
    (nodo.tipoNodo == "Opcional" && Peque.Parser.vieneUnSalto(nodo.nodo())) ||
    (nodo.tipoNodo == "Estrella" && Peque.Parser.vieneUnSalto(nodo.nodo())) ||
    (nodo.tipoNodo == "Pipe" && nodo.opciones().algunoCumple_(Peque.Parser.vieneUnSalto))
  ;
};

Peque.Parser.textoOriginal = function (nodo) {
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
      return `${nodo.clave()} ${nodo.contenido().map(Peque.Parser.textoOriginal)}`;
    case "Varios":
      return `${nodo.contenido().map(Peque.Parser.textoOriginal).join(" ")}`;
    case "Identificador":
      return `${nodo.identificador()}`;
  }
  return "";
};

Peque.Parser._Parser.prototype.CambiarTamañoTabA_ = function(nuevoTamañoTab) {
  Mila.Contrato({
    Proposito: "Cambiar el tamaño de tabs por defecto que este parser espera en las entradas a parsear\
      por el tamaño dado",
    Parametros: [
      [nuevoTamañoTab, Mila.Tipo.Entero]
    ]
  });
  this.tamañoDeTab = nuevoTamañoTab;
};

Peque.Parser._Parser.prototype.CambiarSeparadoresDeLíneaA_ = function(nuevosSeparadoresDeLínea) {
  Mila.Contrato({
    Proposito: "Cambiar los separadores de línea que este parser usará para parsear entradas\
      por los dados",
    Parametros: [
      [nuevosSeparadoresDeLínea, Mila.Tipo.O([TipoSeparadorLínea, Mila.Tipo.ListaDe_(TipoSeparadorLínea)])]
    ]
  });
  this.separadoresDeLínea = {};
  this.separadores = [];
  this.ignorables = [];
  for (let salto of nuevosSeparadoresDeLínea.esUnaLista()
    ? nuevosSeparadoresDeLínea
    : [nuevosSeparadoresDeLínea]
  ) {
    let id = 'id' in salto ? salto.id : `salto_${this.separadoresDeLínea.clavesDefinidas().length}`;
    this.AgregarSeparadorDeLínea_(id, salto.tokens);
    if ('escape' in salto) {
      this.AgregarEscapeSaltoDeLínea_(id, salto.escape);
    }
  }
};

Peque.Parser._Parser.prototype.CambiarAgrupadoresA_ = function(nuevosAgrupadores) {
  Mila.Contrato({
    Proposito: "Cambiar los agrupadores de este parser por los dados",
    Parametros: [
      [nuevosAgrupadores, Mila.Tipo.Registro] // las claves son TipoAgrupador o lista de TipoAgrupador
    ]
  });
  this.agrupadores = {};
  this.iniciadores = [];
  for (let categoria in nuevosAgrupadores) {
    this.AgregarCategoríaAgrupamiento(categoria);
    for (let agrupador of nuevosAgrupadores[categoria].esUnaLista()
      ? nuevosAgrupadores[categoria]
      : [nuevosAgrupadores[categoria]]
    ) {
      this.AgregarAgrupador_En_(agrupador, categoria);
    }
  }
};

Peque.Parser._Parser.prototype.CambiarProduccionesA_ = function(nuevasProducciones) {
  Mila.Contrato({
    Proposito: "Cambiar las producciones de este parser por las dados",
    Parametros: [
      [nuevasProducciones, Mila.Tipo.Registro] // las claves son ProduccionParserPeque o lista de ProduccionParserPeque
    ]
  });
  this.producciones = {};
  for (let categoria in nuevasProducciones) {
    this.AgregarCategoríaProducciones(categoria);
    for (let produccion of nuevasProducciones[categoria].esUnaLista()
      ? nuevasProducciones[categoria]
      : [nuevasProducciones[categoria]]
    ) {
      this.AgregarProduccion_En_(produccion, categoria);
    }
  }
};

Peque.Parser._Parser.prototype.AgregarSeparadorDeLínea_ = function(id, tokens) {
  Mila.Contrato({
    Proposito: "Agregar el token dado o la secuencia de tokens dada como separador de línea para este parser",
    Precondiciones: [
      "No existe un separador de línea con el id dado en este parser",
      !this.separadoresDeLínea.defineLaClave_(id)
    ],
    Parametros: [
      [id, Mila.Tipo.Texto],
      [tokens, TipoToken]
    ]
  });
  this.separadoresDeLínea[id] = {tokens: tokens.esUnaLista()
    ? tokens
    : [tokens]
  };
  this.separadores.push(this.separadoresDeLínea[id].tokens);
};

Peque.Parser._Parser.prototype.AgregarEscapeSaltoDeLínea_ = function(id, tokens) {
  Mila.Contrato({
    Proposito: "Agregar el token dado o la secuencia de tokens dada como secuencia de escape de línea\
      para este parser",
    Precondiciones: [
      "Existe un separador de línea con el id dado en este parser",
      this.separadoresDeLínea.defineLaClave_(id)
    ],
    Parametros: [
      [id, Mila.Tipo.Texto],
      [tokens, TipoToken]
    ]
  });
  this.separadoresDeLínea[id].escape = tokens.esUnaLista()
    ? tokens
    : [tokens]
  ;
  this.ignorables.push(this.separadoresDeLínea[id].escape);
};

Peque.Parser._Parser.prototype.AgregarCategoríaAgrupamiento = function(categoria) {
  Mila.Contrato({
    Proposito: "Agregar una categoria con el nombre dado a las categorías de agrupamientos de este parser",
    Precondiciones: [
      "No existe una categoría de agrupamiento con el nombre dado en este parser",
      !this.agrupadores.defineLaClave_(categoria)
    ],
    Parametros: [
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.agrupadores[categoria] = [];
};

Peque.Parser._Parser.prototype.AgregarAgrupador_En_ = function(agrupador, categoria) {
  Mila.Contrato({
    Proposito: "Agregar el agrupador dado a la categoría de agrupadores dada de este parser",
    Precondiciones: [
      "Existe la categoría de agrupadores dada en este parser",
      this.agrupadores.defineLaClave_(categoria)
    ],
    Parametros: [
      [agrupador, TipoAgrupador],
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.agrupadores[categoria].push(agrupador);
  this.iniciadores.push({
    claveAgrupador:categoria,
    abre: (agrupador.abre.esUnaLista() || agrupador.abre.esUnaFuncion())
      ? agrupador.abre
      : [agrupador.abre]
    ,
    cierra: (agrupador.cierra.esUnaLista() || agrupador.cierra.esUnaFuncion())
      ? agrupador.cierra
      : [agrupador.cierra]
    ,
    cierraAlFinal: 'cierraAlFinal' in agrupador ? agrupador.cierraAlFinal : false
  });
};

Peque.Parser._Parser.prototype.AgregarCategoríaProducciones = function(categoria) {
  Mila.Contrato({
    Proposito: "Agregar una categoria con el nombre dado a las categorías de producciones de este parser",
    Precondiciones: [
      "No existe una categoría de producciones con el nombre dado en este parser",
      !this.producciones.defineLaClave_(categoria)
    ],
    Parametros: [
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.producciones[categoria] = [];
};

Peque.Parser._Parser.prototype.AgregarProduccion_En_ = function(produccion, categoria) {
  Mila.Contrato({
    Proposito: "Agregar la producción dada a la categoría de producciones dada de este parser",
    Precondiciones: [
      "Existe la categoría de producciones dada en este parser",
      this.producciones.defineLaClave_(categoria)
    ],
    Parametros: [
      [produccion, Mila.Tipo.ProduccionParserPeque],
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.producciones[categoria].push(produccion);
};

const tokenLíneaTrim = function(línea) {
  let i=0;
  while (i<línea.length && línea[i] == " ") {
    i++;
  }
  return Peque.Tokens.línea(línea.substring(i), i);
};