import { paymentService } from "../services/paymentService.js";

function requiredString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
}

export const paymentController = {
  async create(req, res, next) {
    try {
      const payment = await paymentService.createPayment({ userId: req.user.id });
      return res.status(201).json({ message: "Link de pagamento criado.", payment });
    } catch (err) {
      next(err);
    }
  },

  async confirm(req, res, next) {
    try {
      const orderNsu = requiredString(req.body?.order_nsu);
      const transactionNsu = requiredString(req.body?.transaction_nsu);
      const invoiceSlug = requiredString(req.body?.slug);
      if (!orderNsu || !transactionNsu || !invoiceSlug) {
        return res.status(400).json({ error: "Dados de retorno do pagamento incompletos." });
      }

      const result = await paymentService.confirmPayment({
        orderNsu,
        transactionNsu,
        invoiceSlug,
        userId: req.user.id,
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async webhook(req, res, next) {
    try {
      const orderNsu = requiredString(req.body?.order_nsu);
      const transactionNsu = requiredString(req.body?.transaction_nsu);
      const invoiceSlug = requiredString(req.body?.invoice_slug || req.body?.slug);
      if (!orderNsu || !transactionNsu || !invoiceSlug) {
        return res.status(400).json({ error: "Dados do pagamento ausentes no webhook." });
      }

      const result = await paymentService.confirmPayment({ orderNsu, transactionNsu, invoiceSlug });
      if (!result.paid) {
        return res.status(503).json({ error: "O pagamento ainda não foi confirmado pela InfinitePay." });
      }
      return res.status(200).json({ received: true, status: result.status });
    } catch (err) {
      next(err);
    }
  },
};
