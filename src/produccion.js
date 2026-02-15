Mila.Modulo({
  define:"Peque.Parser.Produccion",
  necesita:["parser","$milascript/base","$milascript/ast"],
  usa:["tokens"]
});

Mila.Tipo.Registrar({
  nombre:'AtributosProduccionParserPeque',
  es: {
    "tokens":Mila.Tipo.O([Mila.Tipo.NodoAST,Mila.Tipo.ListaDe_(Mila.Tipo.NodoAST),Mila.Tipo.Texto]),
    "?propiedades":Mila.Tipo.Cualquiera, // si 'tokens' es un texto, este el el mapa de propiedades para llenar sus agujeros
    "nodo":Mila.Tipo.Funcion // toma la lista de tokens originales y devuelve el nuevo nodo
  },
  inferible: false
});

Peque.Parser.Produccion.nueva = function(atributos) {
  const nueva = new Peque.Parser.Produccion._Produccion();
  nueva.Regenerar = function() {
    this.tokens = atributos.tokens.esUnTexto()
      ? Peque.Tokens.desdeTexto_(
        atributos.tokens, // TODO: localizar (porque puede ser un texto localizable)
        atributos.propiedades
      )
      : atributos.tokens
    ;
  };
  nueva.Regenerar();
  nueva.nodo = atributos.nodo;
  return nueva;
};

Peque.Parser.Produccion._Produccion = function ProduccionParserPeque() {};

Mila.Tipo.Registrar({
  nombre: "ProduccionParserPeque",
  prototipo: Peque.Parser.Produccion._Produccion
});