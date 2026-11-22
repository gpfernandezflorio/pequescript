Mila.Módulo({
  define:"Peque.Parser",
  necesita:["pequescript","$milascript/base","$milascript/ast","tokens"],
  usa:["estado","produccion"]
});

const tt = Peque.Tokens.texto;
const ts = Peque.Tokens.salto();
const tiMas = Peque.Tokens.indentarMás();
const tiMenos = Peque.Tokens.indentarMenos();

const nT = function(texto) { return Peque.Tokens.atómico(tt(texto)); }
const nS = function() { return Peque.Tokens.atómico(ts); }
const nIMas = function() { return Peque.Tokens.atómico(tiMas); }
const nIMenos = function() { return Peque.Tokens.atómico(tiMenos); }

const nG = Peque.Tokens.grupo;
const nID = Peque.Tokens.nodoIdentificador;

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
    // que matcheó) y, opcionalmente, el campo "agregar" (un nodo o una lista de nodos a agregar tras el match)
    // si matchea o Mila.Nada si no.
  "?cierraAlFinal":Mila.Tipo.Booleano
});

Mila.Tipo.Registrar({
  nombre:'AtributosParserPeque',
  es: {
    "?tamañoDeTab":Mila.Tipo.Entero,
    "?finesDeLínea":Mila.Tipo.O([TipoSeparadorLínea, Mila.Tipo.ListaDe_(TipoSeparadorLínea)]),
    "?agrupadores":Mila.Tipo.Registro, // los valores son TipoAgrupador o lista de TipoAgrupador
    "?agrupadoresIdentificadores":Mila.Tipo.Registro, // los valores son TipoAgrupador o lista de TipoAgrupador
    "?producciones":Mila.Tipo.Registro // los valores son ProduccionParserPeque o lista de ProduccionParserPeque
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

const configuracionesRapidas = {
  finesDeLínea: {
    salto:{ // cada salto es un fin de línea
      tokens:ts
    },
    saltoSalvoQueIndente:{ // cada salto es un fin de línea pero si la línea de abajo
      // está indentada entonces se toma como parte de la anterior
      tokens:ts,
      escape:[ts,tiMas]
    },
    puntoYComa:{ // un punto y coma equivale a un salto de línea
      tokens:tt(";")
    }
  },
  agrupadores: { // y agrupadoresIdentificadores
    paréntesis:{ // encerrado entre paréntesis
      abre:[tt("(")],
      cierra:[tt(")")]
    },
    corchetes:{ // encerrado entre corchetes
      abre:[tt("[")],
      cierra:[tt("]")]
    },
    llaves:{ // encerrado entre llaves
      abre:[tt("{")],
      cierra:[tt("}")]
    },
    menorYMayor:{ // encerrado entre < y >
      abre:[tt("<")],
      cierra:[tt(">")]
    },
    llavesConSalto:{ // encerrado entre paréntesis pero con un salto justo después de abrir
      abre:[tt("{"),ts],
      cierra:[tt("}")]
    },
    dosPuntosConIndentación:{ // abre con dos puntos y cierra cuando des-indenta
      abre:function(tokens, i) {
        if (Peque.Parser.coincideTokensDesde([
          tt(":"),
          ts,
          tiMas
        ], tokens, i)) {
          let k = 3;
          while (
            i+k < tokens.length &&
            Peque.Parser.coincideToken_Con_(tiMas, tokens[i+k])
          ) {
            k++;
          }
          return {cantidad:k, aumentoIndentación:k-2};
        }
        return Mila.Nada;
      },
      cierra:function(apertura, tokens, i) {
        let k=0;
        while (
          k<apertura.aumentoIndentación &&
          i+k < tokens.length &&
          Peque.Parser.coincideToken_Con_(tiMenos, tokens[i+k])
        ) {
          k++;
        }
        return k < apertura.aumentoIndentación
          ? Mila.Nada
          : {cantidad:k, agregar:nS()}
        ;
      }, cierraAlFinal:true
    },
    indentación: { // sólo indenta
      abre:[tiMas],
      cierra:[tiMenos]
    }
  }
};

Peque.Parser.atributosPorDefecto = {
  tamañoDeTab:2,
  finesDeLínea:[
    configuracionesRapidas.finesDeLínea.saltoSalvoQueIndente,
    configuracionesRapidas.finesDeLínea.puntoYComa
  ],
  agrupadores:{},
  agrupadoresIdentificadores:{},
  producciones:{}
};

Peque.Parser.nuevaConfiguración = function(atributos) {
  Mila.Contrato({
    Propósito: [
      "Describir una nueva configuración de parser Pequescript a partir de los atributos dados",
      Mila.Tipo.AtributosParserPeque
    ],
    Parámetros: [
      [atributos, Mila.Tipo.Registro] // claves de acceso rápido
    ]
  });
  const nuevaConfiguracion = Peque.Parser.atributosPorDefecto.copia();
  if (atributos.defineLaClave_('tamañoDeTab')) {
    nuevaConfiguracion.tamañoDeTab = atributos.tamañoDeTab;
  }
  if (atributos.defineLaClave_('finesDeLínea')) {
    let valor = atributos.finesDeLínea;
    if (!valor.esUnaLista()) {
      valor = [valor];
    }
    nuevaConfiguracion.finesDeLínea = valor.transformados(function (x) {
      return x.esUnTexto() ? configuracionesRapidas.finesDeLínea[x] : x;
    });
  }
  if (atributos.defineLaClave_('agrupadores')) {
    for (let categoria of atributos.agrupadores.clavesDefinidas()) {
      let valor = atributos.agrupadores[categoria];
      if (!valor.esUnaLista()) {
        valor = [valor];
      }
      nuevaConfiguracion.agrupadores[categoria] = valor.transformados(function (x) {
        return x.esUnTexto() ? configuracionesRapidas.agrupadores[x] : x;
      });
    }
  }
  if (atributos.defineLaClave_('agrupadoresIdentificadores')) {
    for (let categoria of atributos.agrupadoresIdentificadores.clavesDefinidas()) {
      let valor = atributos.agrupadoresIdentificadores[categoria];
      if (!valor.esUnaLista()) {
        valor = [valor];
      }
      nuevaConfiguracion.agrupadoresIdentificadores[categoria] = valor.transformados(function (x) {
        return x.esUnTexto() ? configuracionesRapidas.agrupadores[x] : x;
      });
    }
  }
  if (atributos.defineLaClave_('producciones')) {
    nuevaConfiguracion.producciones = atributos.producciones;
  }
  return nuevaConfiguracion;
};

Peque.Parser.nuevo = function(atributos=Peque.Parser.atributosPorDefecto) {
  Mila.Contrato({
    Propósito: [
      "Describir un nuevo parser de Pequescript configurado a partir de los atributos dados",
      Mila.Tipo.ParserPeque
    ],
    Parámetros: [
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
  nuevo.CambiarAgrupadoresIdentificadoresA_('agrupadoresIdentificadores' in atributos
    ? atributos.agrupadoresIdentificadores
    : Peque.Parser.atributosPorDefecto.agrupadoresIdentificadores
  );
  nuevo.CambiarProduccionesA_('producciones' in atributos
    ? atributos.producciones
    : Peque.Parser.atributosPorDefecto.producciones
  );
  return nuevo;
};

Peque.Parser._Parser = function ParserPeque() {
  this.produccionesParaRecolecciónDeDefiniciones = {};
  this.produccionesTemporales = {};
};

Mila.Tipo.Registrar({
  nombre: "ParserPeque",
  prototipo: Peque.Parser._Parser
});

Peque.Parser._Parser.prototype.parsear = function(entrada, atributos={}) {
  Mila.Contrato({
    Propósito: [
      "Describir el resultado de parsear la cadena con este parser",
      Mila.Tipo.ResultadoParserPeque
    ],
    Parámetros: [
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
  this._RecogerDefiniciones();
  this._PasrsingFinal();
  this._RestaurarParser();
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
    todosLosTokens.push(nS());
    let nuevaIndentación = token.indentación();
    if (nuevaIndentación > indentaciónAnterior) {
      for (let i=0; i<nuevaIndentación-indentaciónAnterior; i++) {
        todosLosTokens.push(nIMas());
      }
    } else if (nuevaIndentación < indentaciónAnterior) {
      for (let i=0; i<indentaciónAnterior-nuevaIndentación; i++) {
        todosLosTokens.push(nIMenos());
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
  // TODO: guardar los espacios descartados por el trim y por el split en el campo 'textoOriginal' para poder recuperarlo
  let texto = tokenLínea.texto().trim();
  return texto.split(" ").transformados(nT);
};

Peque.Parser._Parser.prototype._AgruparTokens = function() {
  let tokensAnteriores = this.estado.cadena();
  let todosLosTokens = this._tokens_agrupadosCon_(tokensAnteriores, this.iniciadores);
  this.estado.ActualizarCadena_(todosLosTokens);
};

Peque.Parser._Parser.prototype._tokens_agrupadosCon_ = function(listaDeTokens, iniciadores) {
  let todosLosTokens = [];
  let grupos = [];
  let i=0;
  while (i < listaDeTokens.length) {
    let grupo = Peque.Parser.grupoQueInicia(listaDeTokens, i, iniciadores);
    if (grupo.esAlgo()) {
      grupos.push(grupo);
      i+=grupo.abre.cantidad;
    } else {
      i = this._ProcesarToken(listaDeTokens, i, grupos, todosLosTokens);
    }
  }
  while (!grupos.esVacia() && grupos.ultimo().cierraAlFinal) {
    let grupo = grupos.ultimo();
    grupos.SacarUltimo();
    (grupos.length > 0 ? grupos.ultimo().contenido : todosLosTokens)
      .push(nG(grupo.claveAgrupador, grupo.contenido))
    ;
  }
  if (!grupos.esVacia()) {
    // Error
    return [];
  }
  return todosLosTokens;
};

Peque.Parser._Parser.prototype._ProcesarToken = function(tokensAnteriores, i, grupos, todosLosTokens) {
  let reProcesar = false;
  let proximosTokens = [];
  if (grupos.length > 0) {
    let clausura = Peque.Parser.cierraGrupo(tokensAnteriores, i, grupos.ultimo());
    if (clausura.esAlgo()) {
      let grupo = grupos.ultimo();
      grupos.SacarUltimo();
      grupo.clausura = tokensAnteriores.subListaEntre_Y_(i+1, i+clausura.cantidad);
      if (grupo.claveAgrupador == "IGNORAR") {
        proximosTokens = Peque.Parser.contenidoGrupoIgnorado(grupo);
        reProcesar = grupos.length > 0;
      } else {
        proximosTokens.push(nG(grupo.claveAgrupador, grupo.contenido));
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
  if (reProcesar) {
    let j = 0;
    while (j < proximosTokens.length) {
      j = this._ProcesarToken(proximosTokens, j, grupos, todosLosTokens);
    }
  } else {
    for (let token of proximosTokens) {
      (grupos.length > 0 ? grupos.ultimo().contenido : todosLosTokens).push(token);
    }
  }
  return i;
};

Peque.Parser._Parser.prototype._RecogerDefiniciones = function() {
  const esteParser = this;

  // Anulo temporalmente las producciones de comandos y expresiones
  esteParser.produccionesOriginales = {};
  esteParser.produccionesParaRecolecciónDeDefiniciones.ConCadaParClaveValor(
    function(categoría, produccionesParaRecolecciónDeDefiniciones) {
      esteParser.produccionesOriginales[categoría] = esteParser.producciones[categoría];
      esteParser.producciones[categoría] = produccionesParaRecolecciónDeDefiniciones;
    }
  );

  // Hago el parsing con las producciones ficticias
  const nodosSoloDefiniciones = this._ParsearTokens();

  // Anulo las producciones usadas para recolectar definiciones
  esteParser.produccionesOriginales.ConCadaClave(
    function(categoría) {
      esteParser.producciones[categoría] = [];
    }
  );

  // Agrego las producciones derivadas de las definiciones
  nodosSoloDefiniciones.conCadaUno(function(nodoDefinción) {
    if (nodoDefinción.sabeResponder_("nombre") && nodoDefinción.sabeResponder_("categoríaDefinición")) {
      const posibleProducción = esteParser._producciónParaInvocaciónDeDefinición_(nodoDefinción.nombre());
      if (posibleProducción.esAlgo()) {
        esteParser.producciones[nodoDefinción.categoríaDefinición()].push(posibleProducción);
      }
    }
  });

  // Agrego las producciones originales
  esteParser.produccionesOriginales.ConCadaParClaveValor(
    function(categoría, produccionesOriginales) {
      esteParser.producciones[categoría].ConcatenarCon_(produccionesOriginales);
    }
  );
};

Peque.Parser._Parser.prototype._ParsearTokens = function() {
  let tokensLimpios = this._tokensLimpios(this.estado.cadena());
  const líneas = this._líneasDeTokens(tokensLimpios);
  const nodos = [];
  let i=0;
  while (i.esAlgo() && i<líneas.length) {
    i = this._AgregarLíneas_ANodos_EnContexto_(líneas, nodos, "DEFINICION", i);
  }
  return nodos;
};

Peque.Parser._Parser.prototype._PasrsingFinal = function() {
  // TODO: se puede optimizar para que, en lugar de parsear todo otra vez, busque los nodos temporales (COMANDO_TEMPORAL_IDENTIFICADOR, COMANDO_TEMPORAL_GRUPO, EXPRESIÓN_TEMPORAL_IDENTIFICADOR y EXPRESIÓN_TEMPORAL_GRUPO) y los reemplace por el resultado de parsear a sus hijos.
  this.estado.ActualizarCadena_(this._ParsearTokens());
};

Peque.Parser._Parser.prototype._RestaurarParser = function() {
  const esteParser = this;
  esteParser.produccionesOriginales.ConCadaParClaveValor(
    function(categoría, produccionesOriginales) {
      esteParser.producciones[categoría] = produccionesOriginales;
    }
  );
};

Peque.Parser._Parser.prototype._AgregarLíneas_ANodos_EnContexto_ = function(líneas, nodos, contexto, i=0) {
  if (líneas[i].esVacia()) {
    return i+1;
  }
  if (contexto in this.producciones) {
    for (let construccion of this.producciones[contexto]) {
      let líneaAjustada = this._línea_AjustadaA_(líneas, i, construccion);
      if (líneaAjustada.esAlgo()) {
        nodos.push(construccion.nodo(líneaAjustada.línea, líneaAjustada.textoOriginal));
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
    } else if (Peque.Parser.esTextoVacío(token)) { // TODO: conservar estos espacios en blanco en el campo textoOriginal
      i++;
    } else {
      let tokensAIgnorar = this._tokensIgnorables(tokens, i);
      if (tokensAIgnorar > 0) {
        // Ojo: si se ignora un I+ hay que recalcular la indentación del próximo salto
        this._recalcularIndentación(tokens, i, tokensAIgnorar);
        i+=tokensAIgnorar;
      } else {
        if (!Peque.Parser.esIndentación(token)) {
          tokensLimpios.push(token);
        }
        i++;
      }
    }
  }
  return tokensLimpios;
};

Peque.Parser.esTokenAtómico = function(nodo) {
  return nodo.tipoNodo == "Atómico";
};

Peque.Parser.esTextoVacío = function(nodo) {
  return Peque.Parser.esTokenAtómico(nodo) && nodo.token().clase == "Texto" && nodo.token().contenido.length == 0;
};

Peque.Parser.esSalto = function(nodo) {
  return Peque.Parser.esTokenAtómico(nodo) && nodo.token().clase == "Salto";
};

Peque.Parser.esIndentación = function(nodo) {
  return Peque.Parser.esTokenAtómico(nodo) && (nodo.token().clase == "Indentación+" || nodo.token().clase == "Indentación-");
};

Peque.Parser.esIndentaciónMás = function(nodo) {
  return Peque.Parser.esTokenAtómico(nodo) && nodo.token().clase == "Indentación+";
};

Peque.Parser.esIndentaciónMenos = function(nodo) {
  return Peque.Parser.esTokenAtómico(nodo) && nodo.token().clase == "Indentación-";
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

Peque.Parser._Parser.prototype._recalcularIndentación = function(tokens, i, tokensAIgnorar) {
  let tokensQueSeIgnoran = tokens.subListaEntre_Y_(i+1, i+tokensAIgnorar);
  let nuevaIndentación = tokensQueSeIgnoran.cantidadQueNoCumple_(Peque.Parser.esIndentaciónMás);
  if (nuevaIndentación > 0) { // Hay que agregarlos al próximo salto
    let j = i+tokensAIgnorar;
    while (j < tokens.length && !Peque.Parser.esSalto(tokens[j])) {
      j++;
    }
    if (j < tokens.length) {
      // Pero si sigue una I- se anulan
      if (j < tokens.length-1 && Peque.Parser.esIndentaciónMenos(tokens[j+1])) {
        tokens.SacarElementoEnPosicion_(j+2);
      } else {
        tokens.Insertar_EnPosicion_(nIMas(),j+2);
      }
    }
  }
};

Peque.Parser.coincideToken_Con_ = function(tokenModelo, tokenEntrada) {
  Mila.Contrato({
    Propósito:["Indica si los dos tokens dados coinciden.", Mila.Tipo.Booleano],
    Parámetros:[
      [tokenModelo, Mila.Tipo.Token],
      [tokenEntrada, Mila.Tipo.NodoAST]
    ]
  });
  return (
    tokenModelo.clase == "Grupo" &&
    tokenEntrada.tipoNodo == "Grupo" &&
    tokenModelo.contenido == tokenEntrada.clase()
  ) || (
    Peque.Parser.esTokenAtómico(tokenEntrada) &&
    tokenModelo.clase == tokenEntrada.token().clase &&
    (tokenModelo.clase != "Texto" || tokenModelo.contenido == tokenEntrada.token().contenido)
  );
};

Peque.Parser.coincideTokensDesde = function(tokensModelo, tokensEntrada, desde=0) {
  Mila.Contrato({
    Propósito:["Indica si los tokens en la primera lista dada coinciden con los de la segunda a partir del índice dado.", Mila.Tipo.Booleano],
    Parámetros:[
      [tokensModelo, Mila.Tipo.ListaDe_(Mila.Tipo.Token)],
      [tokensEntrada, Mila.Tipo.ListaDe_(Mila.Tipo.NodoAST)],
      [desde, Mila.Tipo.NodoAST]
    ]
  });
  let i=0;
  while (i<tokensModelo.length && Peque.Parser.coincideToken_Con_(tokensModelo[i], tokensEntrada[desde+i])) {
    i++;
  }
  return i == tokensModelo.length;
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
        if (líneas.length <= resultado.i) {
          return Mila.Nada;
        }
        línea = líneas[resultado.i];
        resultado.i++;
        if (proximo.clase != "Estrella") {
          i++;
        }
        j=0;
      } else if (Peque.Parser.puedeTerminarAcá(tokens, i)) {
        return resultado;
      } else {
        return Mila.Nada;
      }
    } else {
      let resultadoLíneaPróximo = this.intentoDeAjustarLínea_A_(línea, j, proximo, tokens.sinLosPrimeros_(i+1));
      if (resultadoLíneaPróximo.esAlgo()) {
        i += resultadoLíneaPróximo.i;
        j = resultadoLíneaPróximo.j;
        resultado.línea.ConcatenarCon_(resultadoLíneaPróximo.n);
      } else {
        return Mila.Nada;
      }
    }
  }
  if (j < línea.length) {
    return Mila.Nada;
  }
  resultado.textoOriginal = resultado.línea.map(x=>x.textoOriginal).join(" ");
  return resultado;
};

Peque.Parser._Parser.prototype.intentoDeAjustarLínea_A_ = function(línea, j, proximo, siguientes) {
  let rec;
  let nodos = [línea[j]];
  let nuevaJ = j+1;
  if (proximo.esTokenAtómico()) {
    switch (proximo.clase) {
      case "Grupo":
        return (línea[j].tipoNodo == "Grupo" && línea[j].clase() == proximo.contenido)
          ? {i:1, j:j+1, n:[this._nodoGrupo(línea[j])]}
          : Mila.Nada
        ;
      case "Recursivo":
        return this._resultadoAcumuladoDeAjusteDeLínea(línea, nodos, siguientes, nuevaJ, this._recursión(proximo.contenido));
      case "Identificador":
        return this._resultadoAcumuladoDeAjusteDeLínea(línea, nodos, siguientes, nuevaJ, nID);
      default:
        return (j < línea.length && Peque.Parser.coincideToken_Con_(proximo, línea[j]))
          ? {i:1, j:j+1, n:[línea[j]]}
          : Mila.Nada
        ;
    }
  }
  switch (proximo.clase) {
    case "Pipe":
      for (let nodo of proximo.opciones()) {
        rec = this.intentoDeAjustarLínea_A_(línea, j, nodo, siguientes);
        if (rec.esAlgo()) {
          return rec;
        }
      }
      return Mila.Nada;
    case "Opcional":
      rec = this.intentoDeAjustarLínea_A_(línea, j, proximo.nodo(), siguientes);
      return (rec.esAlgo()) ? rec : {i:1, j, n:[]};
    case "Estrella":
      rec = this.intentoDeAjustarLínea_A_(línea, j, proximo.nodo(), siguientes.cons(proximo));
      return (rec.esAlgo()) ? Object.assign(rec, {i:0}) : {i:1, j, n:[]};
    case "Secuencia":
      let v = proximo.contenido();
      let resultado = {i:1, j, n:[]};
      let i=0;
      let nuevosSiguientes = v.concatenadaCon_(siguientes);
      while (i<v.length) {
        nuevosSiguientes.SacarPrimero();
        rec = this.intentoDeAjustarLínea_A_(línea, resultado.j, v[i], nuevosSiguientes);
        if (rec.esNada()) {
          return Mila.Nada;
        }
        resultado.j = rec.j;
        resultado.n.ConcatenarCon_(rec.n);
        i+=rec.i;
      }
      return resultado;
  }
};

Peque.Parser._Parser.prototype._resultadoAcumuladoDeAjusteDeLínea = function(línea, nodos, siguientes, j, f) {
  let nuevaJ = j;
  while (nuevaJ < línea.length &&
    !Peque.Parser.token_ColisionaCon_(línea[nuevaJ], siguientes)
  ) {
    nodos.push(línea[nuevaJ]);
    nuevaJ++;
  }
  // TODO: Revisar si tiene sentido ya invocar a 'f'. Podría pasar que hasta ahora venga bien pero se rompa más adelante.
  /* Ej:
    P1: DEFINICIÓN -> EXPRESIÓN a EXPRESIÓN b EXPRESIÓN
    P2: DEFINICIÓN -> EXPRESIÓN o a
      con la cadena "5 o a" va a entrar por la primera y hacer el llamado recursivo con "5 o"
        pero no vale la pena hacerlo porque nunca va a encontrar 'b'.
  */
  return {i:1, j:nuevaJ, n: (
    (Peque.Parser.puedeTerminarAcá(siguientes) || nuevaJ < línea.length)
    ? [f(nodos)]
    : []
  )};
};

Peque.Parser.token_ColisionaCon_ = function(token, siguientes) {
  let tokens = siguientes.esUnaLista() ? siguientes : [siguientes];
  if (tokens.esVacia()) {
    return false;
  }
  let modelo = tokens[0];
  switch (modelo.clase) {
    case "Pipe":
      return modelo.opciones().algunoCumple_(t => Peque.Parser.token_ColisionaCon_(token, t)) || (
        Peque.Parser.esOpcional(modelo) &&
        Peque.Parser.token_ColisionaCon_(token, tokens.sinElPrimero())
      );
    case "Opcional":
      return Peque.Parser.token_ColisionaCon_(token, modelo.nodo()) ||
        Peque.Parser.token_ColisionaCon_(token, tokens.sinElPrimero());
    case "Estrella":
      return Peque.Parser.token_ColisionaCon_(token, modelo.nodo()) ||
        Peque.Parser.token_ColisionaCon_(token, tokens.sinElPrimero());
    case "Secuencia":
        return Peque.Parser.token_ColisionaCon_(token, modelo.contenido().concatenadaCon_(tokens.sinElPrimero()));
  }
  return Peque.Parser.coincideToken_Con_(modelo, token);
};

Peque.Parser._Parser.prototype._recursión = function(clase) {
  const esteParser = this;
  return function(línea) {
    const nodos = [];
    esteParser._AgregarLíneas_ANodos_EnContexto_([línea], nodos, clase);
    if (nodos.length != 1) { debugger; }
    return nodos[0];
  };
};

Peque.Parser._Parser.prototype._nodoGrupo = function(nodo) {
  const nodos = [];
  const líneas = this._líneasDeTokens(nodo.contenido());
  let i=0;
  while (i.esAlgo() && i<líneas.length) {
    i = this._AgregarLíneas_ANodos_EnContexto_(líneas, nodos, nodo.clase(), i);
  }
  return nG(nodo.clase(), nodos);
};

Peque.Parser.puedeTerminarAcá = function(tokens, i=0) {
  return tokens.sinLosPrimeros_(i).todosCumplen_(Peque.Parser.esOpcional);
};

Peque.Parser.esOpcional = function(nodo) {
  return nodo.clase == "Opcional" || nodo.clase == "Estrella" ||
    (nodo.clase == "Pipe" && nodo.opciones().algunoCumple_(Peque.Parser.esOpcional)) ||
    (nodo.clase == "Varios" && nodo.contenido.todosCumplen_(Peque.Parser.esOpcional));
};

Peque.Parser.vieneUnSalto = function(nodo) {
  if (nodo.esTokenAtómico()) {
    return nodo.clase == "Salto";
  }
  return (nodo.clase == "Pipe" && nodo.opciones().algunoCumple_(Peque.Parser.vieneUnSalto)) ||
        (nodo.clase == "Opcional" && Peque.Parser.vieneUnSalto(nodo.nodo())) ||
        (nodo.clase == "Estrella" && Peque.Parser.vieneUnSalto(nodo.nodo())) ||
        (nodo.clase == "Secuencia" && nodo.contenido().length > 0 && Peque.Parser.vieneUnSalto(nodo.contenido()))
  ;
};

Peque.Parser._Parser.prototype.CambiarTamañoTabA_ = function(nuevoTamañoTab) {
  Mila.Contrato({
    Propósito: "Cambiar el tamaño de tabs por defecto que este parser espera en las entradas a parsear\
      por el tamaño dado",
    Parámetros: [
      [nuevoTamañoTab, Mila.Tipo.Entero]
    ]
  });
  this.tamañoDeTab = nuevoTamañoTab;
};

Peque.Parser._Parser.prototype.CambiarSeparadoresDeLíneaA_ = function(nuevosSeparadoresDeLínea) {
  Mila.Contrato({
    Propósito: "Cambiar los separadores de línea que este parser usará para parsear entradas\
      por los dados",
    Parámetros: [
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
    Propósito: "Cambiar los agrupadores de este parser por los dados",
    Parámetros: [
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

Peque.Parser._Parser.prototype.CambiarAgrupadoresIdentificadoresA_ = function(nuevosAgrupadoresIdentificadores) {
  Mila.Contrato({
    Propósito: "Cambiar los agrupadores de identificadores de este parser por los dados",
    Parámetros: [
      [nuevosAgrupadoresIdentificadores, Mila.Tipo.Registro] // las claves son TipoAgrupador o lista de TipoAgrupador
    ]
  });
  this.agrupadoresIdentificadores = {};
  this.iniciadoresIdentificadores = [];
  for (let categoria in nuevosAgrupadoresIdentificadores) {
    this.AgregarCategoríaAgrupamientoIdentificadores(categoria);
    for (let agrupador of nuevosAgrupadoresIdentificadores[categoria].esUnaLista()
      ? nuevosAgrupadoresIdentificadores[categoria]
      : [nuevosAgrupadoresIdentificadores[categoria]]
    ) {
      this.AgregarAgrupadorIdentificador_En_(agrupador, categoria);
    }
  }
};

Peque.Parser._Parser.prototype.CambiarProduccionesA_ = function(nuevasProducciones) {
  Mila.Contrato({
    Propósito: "Cambiar las producciones de este parser por las dados",
    Parámetros: [
      [nuevasProducciones, Mila.Tipo.Registro] // las claves son ProduccionParserPeque o lista de ProduccionParserPeque
    ]
  });
  this.producciones = {};
  this.produccionesParaRecolecciónDeDefiniciones = {};
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
    Propósito: "Agregar el token dado o la secuencia de tokens dada como separador de línea para este parser",
    Precondiciones: [
      "No existe un separador de línea con el id dado en este parser",
      !this.separadoresDeLínea.defineLaClave_(id)
    ],
    Parámetros: [
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
    Propósito: "Agregar el token dado o la secuencia de tokens dada como secuencia de escape de línea\
      para este parser",
    Precondiciones: [
      "Existe un separador de línea con el id dado en este parser",
      this.separadoresDeLínea.defineLaClave_(id)
    ],
    Parámetros: [
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
    Propósito: "Agregar una categoria con el nombre dado a las categorías de agrupamientos de este parser",
    Precondiciones: [
      "No existe una categoría de agrupamiento con el nombre dado en este parser",
      !this.agrupadores.defineLaClave_(categoria)
    ],
    Parámetros: [
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.agrupadores[categoria] = [];
};

Peque.Parser._Parser.prototype.AgregarCategoríaAgrupamientoIdentificadores = function(categoria) {
  Mila.Contrato({
    Propósito: "Agregar una categoria con el nombre dado a las categorías de agrupamientos de identificarores de este parser",
    Precondiciones: [
      "No existe una categoría de agrupamiento de identificadores con el nombre dado en este parser",
      !this.agrupadoresIdentificadores.defineLaClave_(categoria)
    ],
    Parámetros: [
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.agrupadoresIdentificadores[categoria] = [];
};

Peque.Parser._Parser.prototype.AgregarAgrupador_En_ = function(agrupador, categoria) {
  Mila.Contrato({
    Propósito: "Agregar el agrupador dado a la categoría de agrupadores dada de este parser",
    Precondiciones: [
      "Existe la categoría de agrupadores dada en este parser",
      this.agrupadores.defineLaClave_(categoria)
    ],
    Parámetros: [
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

Peque.Parser._Parser.prototype.AgregarAgrupadorIdentificador_En_ = function(agrupadorIdentificadores, categoria) {
  Mila.Contrato({
    Propósito: "Agregar el agrupador de identificadores dado a la categoría de agrupadores de identificadores dada de este parser",
    Precondiciones: [
      "Existe la categoría de agrupadores de identificadores dada en este parser",
      this.agrupadoresIdentificadores.defineLaClave_(categoria)
    ],
    Parámetros: [
      [agrupadorIdentificadores, TipoAgrupador],
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.agrupadoresIdentificadores[categoria].push(agrupadorIdentificadores);
  this.iniciadoresIdentificadores.push({
    claveAgrupador:categoria,
    abre: (agrupadorIdentificadores.abre.esUnaLista() || agrupadorIdentificadores.abre.esUnaFuncion())
      ? agrupadorIdentificadores.abre
      : [agrupadorIdentificadores.abre]
    ,
    cierra: (agrupadorIdentificadores.cierra.esUnaLista() || agrupadorIdentificadores.cierra.esUnaFuncion())
      ? agrupadorIdentificadores.cierra
      : [agrupadorIdentificadores.cierra]
    ,
    cierraAlFinal: 'cierraAlFinal' in agrupadorIdentificadores ? agrupadorIdentificadores.cierraAlFinal : false
  });
};

Peque.Parser._Parser.prototype.AgregarCategoríaProducciones = function(categoria) {
  Mila.Contrato({
    Propósito: "Agregar una categoria con el nombre dado a las categorías de producciones de este parser",
    Precondiciones: [
      "No existe una categoría de producciones con el nombre dado en este parser",
      !this.producciones.defineLaClave_(categoria)
    ],
    Parámetros: [
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.producciones[categoria] = [];
  if (categoria != "DEFINICION") {
    this.produccionesParaRecolecciónDeDefiniciones[categoria] = [{
        tokens: Peque.Tokens.agrupado(categoria),
        categoría: "GRUPO"
      },{
        tokens: Peque.Tokens.tokenIdentificador(),
        categoría: "IDENTIFICADOR"
    }].transformados(function(datos) {
      return Peque.Parser.Produccion.nueva({
        tokens:datos.tokens, nodo:function(tokens) {
          return Mila.AST.nuevoNodo({
            tipoNodo: `${categoria}_TEMPORAL_${datos.categoría}`,
            campos: {tokenOriginal:tokens[0]},
            textoOriginal: "-",
            contexto: categoria
          });
        }
      })
    });
  }
};

Peque.Parser._Parser.prototype.AgregarProduccion_En_ = function(produccion, categoria) {
  Mila.Contrato({
    Propósito: "Agregar la producción dada a la categoría de producciones dada de este parser",
    Precondiciones: [
      "Existe la categoría de producciones dada en este parser",
      this.producciones.defineLaClave_(categoria)
    ],
    Parámetros: [
      [produccion, Mila.Tipo.ProduccionParserPeque],
      [categoria, Mila.Tipo.Texto]
    ]
  });
  this.producciones[categoria].push(produccion);
};

Peque.Parser._Parser.prototype._producciónParaInvocaciónDeDefinición_ = function(nodoNombre) {
  Mila.Contrato({
    Propósito:[
      "Describe una producción que permita parsear una invocación a la definición con el nombre dado",
      Mila.Tipo.ProduccionParserPeque
    ],
    Parámetros:[
      [nodoNombre, Mila.Tipo.NodoAST]
    ]
  });
  const tokensNombre = this._tokens_agrupadosCon_(nodoNombre.tokens(), this.iniciadoresIdentificadores);
  const tokensProducción = [];
  const índicesArgumentos = {};
  let i = 0;
  tokensNombre.conCadaUno(function(token) {
    if (token.tipoNodo == "Atómico") {
      tokensProducción.push(tt(token.texto()));
    } else { // token.tipoNodo == "Grupo"
      índicesArgumentos[token.textoOriginal] = i;
      tokensProducción.push(Peque.Tokens.recursivo(token.clase()));
    }
    i++;
  });
  return Peque.Parser.Produccion.nueva({
    tokens:tokensProducción, nodo:function(tokens) {
      const argumentos = {};
      índicesArgumentos.ConCadaParClaveValor(function(nombre, índice) {
        argumentos[`argumento ${nombre}`] = tokens[índice];
      });
      return Mila.AST.nuevoNodo({
        tipoNodo: "Invocación",
        campos: {parámetros:índicesArgumentos.clavesDefinidas()},
        hijos: argumentos.conLaClave_YElValor_("nombre", nodoNombre)
      });
    }
  });
};

const tokenLíneaTrim = function(línea) {
  let i=0;
  while (i<línea.length && línea[i] == " ") {
    i++;
  }
  return Peque.Tokens.línea(línea.substring(i), i);
};