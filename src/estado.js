Mila.Modulo({
  define:"Peque.Parser.Estado",
  necesita:["parser","$milascript/base"]
});

Mila.Tipo.Registrar({
  nombre:'AtributosEstadoParserPeque',
  es: {
    "tamañoDeTab":Mila.Tipo.Entero
  },
  inferible: false
});

Peque.Parser.Estado._Estado = function EstadoParserPeque(entrada, tamañoDeTab) {
  this._entrada = entrada;
  this._cadena = entrada;
  this._tamañoDeTab = tamañoDeTab;
  this._i = 0;
};

Mila.Tipo.Registrar({
  nombre: "EstadoParserPeque",
  prototipo: Peque.Parser.Estado._Estado
});

Peque.Parser.Estado.nuevo = function(entrada, atributos) {
  const nuevo = new Peque.Parser.Estado._Estado(entrada, atributos.tamañoDeTab);
  return nuevo;
};

Peque.Parser.Estado._Estado.prototype.entrada = function() {
  return this._entrada;
};

Peque.Parser.Estado._Estado.prototype.cadena = function() {
  return this._cadena;
};

Peque.Parser.Estado._Estado.prototype.ActualizarCadena_ = function(nuevaCadena) {
  this._cadena = nuevaCadena;
};