Desejo saber sobre a possíbilidade de exibir os videos do jellyfin
por meio de outro client web, um frontEnd nosso.

estou pensando em criar um serviço onde o cliente cria a conta
temos um prazo de 2 dias grátis para avaliar o serviço
mas devemos ser capazes de deixar a conta inativa caso não seja pago

já estamos com o serviço que cria a conta até ai tudo bem
mas precisamos ser capazes de deslogar o cliente caso não pague

então pensei em não fazer isso diretamente no jellyfin
mas sim num webClient nosso 
assim quando não estiver pago podemos
deslogar o cliente ou leva-lo até a tela de pagamentos.

a integração com pagamento já tenho uma api de pagamentos em mente.
mas preciso saber da viabilidade dessa ideia

cadastro grátis - login liberado - após prazo se não pagar o login é desabilitado
e somente habilitado novamente após pagamento.