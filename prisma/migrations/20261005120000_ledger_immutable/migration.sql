-- Grand livre append-only : ni UPDATE ni DELETE.
DROP TRIGGER IF EXISTS ledger_entries_no_update;
DROP TRIGGER IF EXISTS ledger_entries_no_delete;

CREATE TRIGGER ledger_entries_no_update
BEFORE UPDATE ON `ledger_entries`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is immutable';

CREATE TRIGGER ledger_entries_no_delete
BEFORE DELETE ON `ledger_entries`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is immutable';
