Mila.Modulo({
  define:"Peque.Parser.Produccion",
  necesita:["parser","$milascript/base","$milascript/ast"]
});

const TipoToken = Mila.Tipo.O([Mila.Tipo.NodoAST,Mila.Tipo.ListaDe_(Mila.Tipo.NodoAST)]);

Mila.Tipo.Registrar({
  nombre:'AtributosProduccionParserPeque',
  es: {
    "tokens":TipoToken,
    "nodo":Mila.Tipo.Funcion // toma la lista de tokens originales y devuelve el nuevo nodo
  },
  inferible: false
});

Peque.Parser.Produccion.nueva = function(atributos) {
  const nueva = new Peque.Parser.Produccion._Produccion();
  nueva.tokens = atributos.tokens;
  nueva.nodo = atributos.nodo;
  return nueva;
};

Peque.Parser.Produccion._Produccion = function ProduccionParserPeque() {};

Mila.Tipo.Registrar({
  nombre: "ProduccionParserPeque",
  prototipo: Peque.Parser.Produccion._Produccion
});