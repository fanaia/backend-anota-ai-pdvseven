const { inserirPedidoNoPDVSeven, sincronisarStatus } = require("./models");
const { getPool } = require("./config/db");

const {anotaaiApi} = require("./config/axios")
const {procurarTagChaveValor} = require("./services/tag")

const pedidosController = async (req, res) => {
  await processarPedidosImportacao();
  await processarPedidosExportacao();

  res.status(200).json({ message: "Pedidos sendo processados..." });
};

const processarPedidosImportacao = async () => {
  // console.log("processarPedidosImportacao");
  try {
    const response = await anotaaiApi.get("/ping/list?excludeIfood=1&groupOrdersByTable=1");
    const pedidos = response.data.info.docs;

    if (pedidos.length === 0) {
      console.log("Nenhum pedido encontrado");
      return;
    }

    for (const pedido of pedidos) {
    const tag = await procurarTagChaveValor({chave: "anotaai-_orderId", valor: pedido._id})

    // Adiciona pedidos ao pvd7
     if(!tag){
      // if(pedido.check === 0){
        console.log("adicionando pedido", pedido);
        
        const detalhesResponse = await anotaaiApi.get(`/ping/get/${pedido._id}`);
        const pedidoCompleto = detalhesResponse.data.info;
 
        inserirPedidoNoPDVSeven(pedidoCompleto);
        // }
     }
    }
  } catch (error) {
    console.error("Erro ao importar pedidos:", error);
  }
};

const processarPedidosExportacao = async () => {
  const pool = await getPool()
  
  try {
    // Tipo: delivery, Origem: anotaai, Data: 6 Horas mais recentes
    const pedidos = await pool
    .request()
    .query(`
      SELECT *
      FROM [dbo].[tbPedido]
      WHERE IDTipoPedido = 30
        AND IDOrigemPedido = 4
        AND DtPedido >= DATEADD(HOUR, -6, GETDATE());
    `);

    if(pedidos.recordset.length === 0){
      console.log("não foram encontrados pedidos...");
      return 
    }

    for (const pedido of pedidos.recordset ) {
      sincronisarStatus({pedido})
    } 
  } catch (error) {
    console.error("Erro ao sincronisar pedidos:", error);
  }
}

module.exports = { pedidosController };
