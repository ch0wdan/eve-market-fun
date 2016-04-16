export default function (BaseModel, BaseCollection, Models) {
  const WalletJournal = BaseModel.extend({
    tableName: 'WalletJournal'
  });

  const WalletJournals = BaseCollection.extend({
    model: WalletJournal
  });

  return {WalletJournal, WalletJournals};
}
