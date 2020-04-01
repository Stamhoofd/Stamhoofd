import { Database } from "./Database";
import Stack from "../../debug/Stack";
import { ManyToOneRelation } from "./ManyToOneRelation";
import { ManyToManyRelation } from "./ManyToManyRelation";
import { Column } from "./Column";

export class Model /* static implements RowInitiable<Model> */ {
    static primaryKey: string;

    /**
     * Properties that are stored in the table (including foreign keys, but without mapped relations!)
     */
    static columns: Column[];
    static debug = false;
    static table: string; // override this!
    static relations: ManyToOneRelation<string, Model>[];

    existsInDatabase = false;
    updatedProperties = {};

    constructor() {
        // Read values
        if (!this.static.relations) {
            this.static.relations = [];
        }

        if (!this.static.columns) {
            this.static.columns = [];
        }
    }

    /**
     * Returns the default select to select the needed properties of this table
     * @param namespace: optional namespace of this select
     */
    static getDefaultSelect(namespace: string = this.table): string {
        return "`" + namespace + "`.*";
    }

    static selectColumnsWithout(namespace: string = this.table, ...exclude: string[]): string {
        const properties = this.columns
            .map(column => column.name)
            .flatMap(name => (exclude.includes(name) ? [] : [name]));

        if (properties.length == 0) {
            // todo: check what to do in this case.
            throw new Error("Not implemented yet");
        }
        return "`" + namespace + "`.`" + properties.join("`, `" + namespace + "`.`") + "`";
    }

    /**
     * Set a relation to undefined, marking it as not loaded (so it won't get saved in the next save)
     * @param relation
     */
    unloadRelation<Key extends keyof any, Value extends Model>(
        this: this & Record<Key, Value>,
        relation: ManyToOneRelation<Key, any>
    ): this & Record<Key, undefined> {
        // Todo: check if relation is nullable?
        const t = this as any;
        t[relation.modelKey] = undefined;
        return t;
    }

    /**
     * Set a relation to null, deleting it on the next save (unless unloadRelation is called)
     * @param relation
     */
    unsetRelation<Key extends keyof any, Value extends Model>(
        this: this & Record<Key, Value>,
        relation: ManyToOneRelation<Key, any>
    ): this & Record<Key, null> {
        // Todo: check if relation is nullable?
        const t = this as any;
        t[relation.modelKey] = null;
        return t;
    }

    setRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToOneRelation<Key, Value>,
        value: Value | null
    ): this & Record<Key, Value | null> {
        if (value !== null && !value.existsInDatabase) {
            throw new Error("You cannot set a relation to a model that are not yet saved in the database.");
        }
        const t = this as any;
        t[relation.modelKey] = value;
        return t;
    }

    setManyRelation<Key extends keyof any, Value extends Model>(
        relation: ManyToManyRelation<Key, any, Value>,
        value: Value[]
    ): this & Record<Key, Value[]> {
        value.forEach(v => {
            if (!v.existsInDatabase) {
                throw new Error("You cannot set a relation to models that are not yet saved in the database.");
            }
        });
        const t = this as any;
        t[relation.modelKey] = value;
        return t;
    }

    /**
     * Load the returned properties from a DB response row into the model
     * If the row's primary key is null, undefined is returned
     */
    static fromRow<T extends typeof Model>(this: T, row: any): InstanceType<T> | undefined {
        if (row[this.primaryKey] === null || row[this.primaryKey] === undefined) {
            return undefined;
        }

        const model = new this() as InstanceType<T>;
        this.columns.forEach(column => {
            if (row[column.name] !== undefined) {
                const value = column.from(row[column.name]);
                model[column.name] = value;
            }
        });

        model.markSaved();
        return model;
    }

    static fromRows<T extends typeof Model>(this: T, rows: any[], namespace: string): InstanceType<T>[] {
        return rows.flatMap(row => {
            const model = this.fromRow(row[namespace]);
            if (model) {
                return [model];
            }
            return [];
        });
    }

    private markSaved() {
        this.updatedProperties = {};
        this.existsInDatabase = true;

        /// Save relation foreign keys (so we can check if the id has changed)
        this.static.relations.forEach(relation => {
            if (relation.isLoaded(this)) {
                if (relation.isSet(this)) {
                    const model = this[relation.modelKey];
                    this["_" + relation.foreignKey] = model.getPrimaryKey();
                } else {
                    this["_" + relation.foreignKey] = null;
                }
            }
        });
    }

    get static(): typeof Model {
        return this.constructor as typeof Model;
    }

    getPrimaryKey(): number | null {
        return this[this.static.primaryKey];
    }

    /**
     *
     * @param force: Save all defined properties, even when no propery is modified. This is enabled by default is the model is not yet inserted in the database yet.
     */
    async save(force = false): Promise<void> {
        if (!this.static.table) {
            throw new Error("Table name not set");
        }
        console.log("Saving to table ", this.static.table);

        if (!this.static.primaryKey) {
            throw new Error("Primary key not set for model " + this.constructor.name + " " + this.static);
        }

        const id = this[this.static.primaryKey];
        if (!id) {
            if (this.existsInDatabase) {
                throw new Error(
                    "Model " +
                        this.constructor.name +
                        " was loaded from the Database, but didn't select the ID. Saving not possible."
                );
            }
            force = true;

            if (this.static.debug) console.log(`Creating new ${this.constructor.name}`);

            // Check if all properties are defined
            this.static.columns.forEach(column => {
                if (this[column.name] === undefined) {
                    throw new Error(
                        "Tried to save model " +
                            this.constructor.name +
                            " without defining required property " +
                            column.name
                    );
                }
            });
        } else {
            if (!this.existsInDatabase) {
                throw new Error(
                    `PrimaryKey was set programmatically without fetching the model ${this.constructor.name} from the database`
                );
            }

            if (this.static.debug)
                console.log(`Updating ${this.constructor.name} where ${this.static.primaryKey} = ${id}`);

            // Only check if all updated properties are defined
        }

        // Check if relation models were modified
        this.static.relations.forEach(relation => {
            if (
                relation.isLoaded(this) &&
                (!this.updatedProperties[relation.foreignKey] ||
                    (!this.existsInDatabase &&
                        (this[relation.foreignKey] === undefined || this[relation.foreignKey] === null)))
            ) {
                if (relation.isSet(this)) {
                    const model = this[relation.modelKey];
                    if (!model.existsInDatabase) {
                        throw new Error("Relation " + relation.modelKey + " set that doesn't exist in database");
                    }
                    if (model.getPrimaryKey() !== (this["_" + relation.foreignKey] as number)) {
                        this.updatedProperties[relation.foreignKey] = this[relation.foreignKey];
                    }
                } else {
                    if (this["_" + relation.foreignKey] !== null) {
                        // Relation has been cleared by unsetting the relation without clearing the foreign key
                        // So we clear the foreign key manually
                        this.updatedProperties[relation.foreignKey] = null;
                    }
                }
            }
        });

        if (Object.keys(this.updatedProperties).length == 0) {
            if (!force) {
                console.warn("Tried to update model without any properties modified");
                return;
            }
        }

        if (force) {
            /// Mark all properties as updated
            this.static.columns.forEach(column => {
                if (this[column.name] !== undefined) {
                    this.updatedProperties[column.name] = true;
                }
            });

            if (Object.keys(this.updatedProperties).length == 0) {
                throw new Error("Nothing to save! All properties are undefined.");
            }
        }

        const set = {};

        this.static.columns.forEach(column => {
            if (column.primary) {
                return;
            }
            if (this.updatedProperties[column.name]) {
                if (this[column.name] === undefined) {
                    console.log(this);
                    throw new Error(
                        "Tried to update model " + this.constructor.name + " with undefined property " + column.name
                    );
                }
                set[column.name] = column.to(this[column.name]);
            }
        });

        if (this.static.debug) console.log("Saving " + this.constructor.name + " to...", set);

        // todo: save here
        if (!id) {
            const [result] = await Database.insert("INSERT INTO `" + this.static.table + "` SET ?", [set]);
            this[this.static.primaryKey] = result.insertId;
            if (this.static.debug) console.log(`New id = ${this[this.static.primaryKey]}`);
        } else {
            const [result] = await Database.update(
                "UPDATE `" + this.static.table + "` SET ? WHERE `" + this.static.primaryKey + "` = ?",
                [set, id]
            );
            if (result.changedRows != 1) {
                try {
                    console.log(Stack.parentFile);
                    console.warn(
                        `Updated ${this.constructor.name}, but it didn't change a row. Check if ID exists. At ${Stack.parentFile}:${Stack.parentLine}`
                    );
                } catch (e) {
                    console.error(e);
                }
            }
        }

        // Relations

        // Next
        for (const key in this.updatedProperties) {
            if (this.static.debug) console.log("Saved property " + key + " to " + this[key]);
        }

        // Mark everything as saved
        this.markSaved();
    }
}
