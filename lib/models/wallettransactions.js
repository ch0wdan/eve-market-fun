export default function (BaseModel, BaseCollection, Models) {
  const WalletTransaction = BaseModel.extend({
    tableName: 'WalletTransactions'
  });

  const WalletTransactions = BaseCollection.extend({
    model: WalletTransaction
  });

  return {WalletTransaction, WalletTransactions};
}
